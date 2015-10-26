(function(angular, _) {
  var module = angular.module('MosaicApp');
  module.directive('libFileChooser', ['$rootScope', function($rootScope) {
    return {
      restrict: 'AE',
      template: '<input type="file" id="libChooser" nwdirectory/>',
      link: function(scope, elem, attrs) {
        elem.on('change', function(event) {
          console.log(event);
          var files = elem.find('input')[0].files;
          console.log(elem[0].files);
          var dir = files[0].path;
          console.log(dir);
          scope.dirPath = dir;
          fs.readdir(dir, function(err, files) {
            if (err) return console.log(err);
            var imgExtensions = ['.png', '.jpg', 'jpeg'];
            var imageFiles = _.filter(files, function(f) {
              return _.contains(imgExtensions, path.extname(f).toLowerCase());
            });
            scope.images = _.map(imageFiles, function(im) {
              return dir + '/' + im;
            });
            $rootScope.$broadcast('selectedDir', scope.images);
          });
        });
      }
    };
  }]);
})(angular, _);