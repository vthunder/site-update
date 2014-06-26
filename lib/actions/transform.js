var path = require('path'),
    fs = require('q-io/fs'),
    cheerio = require('cheerio'),
    globals = {};

exports.name = "transform";
exports.init = function(globalvars) {
  globals = globalvars;
}
exports.run = function(srcfile, config) {
  var destname = config("destname"),
      destdir = config("destdir"),
      resolved = path.resolve(globals.sitedir, destdir),
      destpath = path.join(resolved, destname);

  return fs.read(srcfile)
         .then(function(content) {
           var $ = cheerio.load(content);

           config("transform").forEach(function(transform) {
             var change = transform[0],
                 selector = transform[1],
                 data = transform[2];
             switch (change) {
             case "remove":
               $(selector).remove();
               break;
             case "removeElse":
               var keep = $.html(selector);
               $ = cheerio.load(keep);
               break;
             case "empty":
               $(selector).empty();
               break;
             case "replace":
               $(selector).replaceWith(data);
               break;
             case "append":
               $(selector).append(data);
               break;
             case "prepend":
               $(selector).prepend(data);
               break;
             default:
               throw new Error("Unknown html transform: " + change)
             }
           });

           return fs.makeTree(resolved)
                  .then(fs.write.bind(fs, destpath, $.html()));
         });
}
