(function(angular, $) {
  global.$ = $;

  var nwGui = require('nw.gui'),
    async = require('async'),
    gm = require('gm').subClass({imageMagick: true}),
    im = require('imagemagick'),
    fs = require('fs'),
    path = require('path'),
    randomstring = require('randomstring'),
    _ = require('lodash'),
    colorThief = new ColorThief(),
    basePath = 'images/large_copy/';


  var module = angular.module('MosaicApp', ['ngFileUpload', 'snap']);
  module.config(['snapRemoteProvider', function(snapRemoteProvider) {
    snapRemoteProvider.globalOptions.disable = 'right';
  }]);

  module.controller('SidebarCtrl', ['$rootScope', '$scope', 'PhotoLibraryService', function($rootScope, $scope, PhotoLibraryService) {
    $rootScope.showSidebar = true;
    $scope.$on('selectedDir', function(event, data) {
      $scope.imgViews = data.slice(450);
      $scope.$apply();
    });
  }]);


  module.controller('MainCtrl', ['$rootScope', '$scope', 'PhotoLibraryService', function($rootScope, $scope, PhotoLibraryService) {
    $scope.setLibraryPath = PhotoLibraryService.setBasePath;
    $scope.setLibrary = function($files) {
      console.log('$files', $files);
      PhotoLibraryService.setLibrary = $files[0].path;

      $scope.selectedImage = $files[0].path;
    };

  }]);

  var closestRandom = function(color) {
    var distance = 99999999;
    var closest, d, im;
    var matches = [];
    for (var i = 1; i < sampleColors.length; i++){
      im = sampleColors[i];
      d = Math.sqrt(
        Math.pow((color[0] - im.rgb[0]), 2) +
        Math.pow((color[1] - im.rgb[1]), 2) +
        Math.pow((color[2] - im.rgb[2]), 2)
      );

      if (d < distance){
        distance = d;
        closest = im.i;
        //closest = i;
      }
      if (d < 17) {
        matches.push(im.i);
      }
    }

    if (!matches.length) {
      console.log(closest);
      return closest;
      //return 'lustigers/small_cropped/' + closest;
    }
    var rand = matches[Math.floor(Math.random() * matches.length)];
    return rand;
    //return 'lustigers/small_cropped/' + rand;
  }

  var processPixels = function(_area) {
    (function(area) {
      gm('experiments/Binyomin.jpg')
        .crop(area.width, area.height, area.startx, area.starty)
        .noProfile()
        .toBuffer(function(err, croppedBuffer) {
          if (err) console.log('error while cropping', err);
          gm(croppedBuffer).scale(1, 1, '!').toBuffer(function(err, scaledBuffer) {
            if (err) console.log('error scaling', err);
            gm(scaledBuffer).identify('%[pixel:s]', function(err, info) {
              console.log('POST CROP', area, info);
              croppedBuffer = null;
              scaledBuffer = null;
            });
            console.log('scaled', area);
          });
        });
    })(_area);
  };


  //var imgPath = '/tmp/' + randomstring.generate(7) + '.png';
  var imgPath = 'upload.png';
  function Mosaic(dataURI) {
    var img = this.img = new Image();
    this.dataURI = dataURI;
    var data = dataURI.replace(/^data:image\/.*;base64,/, "")
    fs.writeFileSync(imgPath, data, 'base64');

    img.addEventListener('load', this.imageLoaded.bind(this));
    img.src = this.dataURI;
  }

  Mosaic.prototype.imageLoaded = function() {
    var canvas = document.getElementById('main-canvas');

    var stage = new createjs.Stage('main-canvas');
    var targetStage = new createjs.Stage('mosaic-canvas');
    var bitmap = new createjs.Bitmap(this.img);

    bitmap.x = canvas.width/2 - bitmap.image.width/2;
    bitmap.y = canvas.height/2 - bitmap.image.width/2;

    // bitmap.addEventListener('click', function(event) {
    //   bitmap.rotation = 35;
    //   bitmap.alpha = 0.5;
    //   console.log('click', bitmap);
    //   stage.update();
    // });
    console.log(bitmap.image.width, bitmap.image.height);
    stage.addChild(bitmap);
    stage.canvas.width = bitmap.image.width;
    stage.canvas.height = bitmap.image.height;

    var self = this,
    tileW = 15, tileH = 15,
    area = {
      width: tileW,
      height: tileH
    },
    y = 0, x = 0, counter = 0;
    var time = new Date() / 1000;
    console.log('time', time);
    console.log('COLOR THIEF', colorThief.getColor(self.img, 100));

    var imCount = 0;
    function getDominantColor(startx, starty, cb) {
      area.startx = startx;
      area.starty = starty;
      console.log(counter, area);
      var str = ++imCount + '.png';
      var geometry = tileW + 'x' + tileH + '+' + area.startx + '+' + area.starty;
      var imArgs = [imgPath, '-crop', geometry, '+repage', '-scale', '1x1\!', '-format', '%[pixel:s]', 'info:-'];
      //var imArgs = [imgPath, '-crop', geometry, '+repage', '+adjoin', str];
      im.convert(imArgs, function(err, stdout){
        if (err) console.log(err);
        // var rgbStr = stdout.slice(1);
        var rgb = stdout.substring(stdout.indexOf('(') + 1, stdout.indexOf(')')).split(',');
        rgb = rgb.map(function(v) {
          return parseInt(v);
        });
        console.log(rgb);

        // tile.graphics.beginFill(rgbStr).drawRect(0, 0, tileW, tileH);
        // tile.x = startx;
        // tile.y = starty;
        // targetStage.addChild(tile);
        // targetStage.update();
        return cb(null, rgb);
      });

    }

    var mosaicMap = [], mapY = [], mapX = [], rowMap = [];
    async.whilst(
      function checkY() { return y < stage.canvas.height; },
      function yLoop(yCallback) {
        rowMap = [];
        async.whilst(
          function checkX() { return x < stage.canvas.width; },
          function xLoop(xCallback) {
            var dominant, closest;
            getDominantColor(x, y, function(err, dominant) {
              closest = closestRandom(dominant);
              rowMap.push({x: x, y: y, dom: dominant, closest: closest});
              return xCallback();
            });
            x += tileW;
          },
          function finishedRow(err) {
            console.log(rowMap);
            var _tile;
            rowMap.forEach(function(elem, i) {
              _tile = new createjs.Bitmap(basePath + elem.closest);
              _tile.x = elem.x;
              _tile.y = elem.y;
              _tile.addEventListener('click', function(event) {
                _tile.width = 20;
                _tile.height = 20
                 console.log('hover', bitmap);
                 stage.update();
              });

              _tile.addEventListener('mouseleave', function(event) {
                 _tile.width = tileW;
                 _tile.height = tileH;
                 console.log('mouseleave', bitmap);
                 stage.update();
              });
              targetStage.addChild(_tile);
            });
            targetStage.update();
            x = 0;
            y += tileH;
            return yCallback();
          }
        )
      },
      function finishedAllRows(err) {

        var overlay = new createjs.Bitmap(this.img);
       // overlayContext.drawImage(this.img, 0, 0, this.img.width, this.img.height);
        //overlayContext.globalAlpha = 0.5;

        stage.update();
        console.log('ELAPSED', (new Date() / 1000) - time);
      }
    );
    // while (y < stage.canvas.height) {
    //   mapX = [];

    //   while (x < stage.canvas.width) {
    //     counter++;
    //       // tile.onload = function() {
    //       //   self.targetCanvasContext.drawImage(tile, startx, starty, tileW, tileH);
    //       // };
    //       // tile.src = closest;
    //     // if (counter % 50 === 0) {
    //     //   getDominantColor(x, y);
    //     //   x += tileW;
    //     //   console.log('x', x);
    //     // } else {
    //     //   setTimeout(function() {
    //     //     getDominantColor(x, y);
    //     //     x += tileW;
    //     //      console.log('x!' ,x);
    //     //   }, 50);
    //     // }

    //     //mosaicMap.push(mapX);
    //     //setTimeout(function() {
    //       getDominantColor(x, y);
    //        x += tileW;
    //     //}, 20);

    //   }
    //   x = 0;
    //   y += tileH;
    // }
    //stage.update();
    //console.log('ELAPSED', (new Date() / 1000) - time);
    //console.log(mosaicMap);

    //console.log(stage);

    // var tile = new Image();
    // tile.onload = function() {
    //   var tile = new createjs.Bitmap(tile);
    //   stage.addChild(tile);
    //   stage.update();
    // };
    // tile.src = 'images/small_cropped/20141102_075452.jpg';


  };

  $(document).ready(function() {
    var btn = document.getElementById('upload-btn');
    btn.addEventListener('change', function() {
      var file = btn.files[0];
      var reader = new FileReader();
      reader.onloadend = function () {
        new Mosaic(reader.result);
      }
      reader.readAsDataURL(file);
    });
  });
})(angular, $);