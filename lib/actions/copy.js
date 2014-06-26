var path = require('path'),
    fs = require('q-io/fs'),
    globals = {};

exports.name = "copy";
exports.init = function(globalvars) {
  globals = globalvars;
}
exports.run = function(srcfile, config) {
  var destname = config("destname"),
      destdir = config("destdir"),
      resolved = path.resolve(globals.sitedir, destdir),
      destpath = path.join(resolved, destname);
  return fs.makeTree(resolved)
         .then(fs.copy.bind(fs, srcfile, destpath));
}
