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
                 arg1 = transform[2],
                 arg2 = transform[3];
             switch (change) {
             case "remove":
             case "empty":
               $(selector)[change]();
               break;
             case "val":
             case "removeAttr":
             case "removeClass":
             case "append":
             case "prepend":
             case "after":
             case "before":
             case "replaceWith":
             case "html":
             case "text":
               $(selector)[change](arg1);
               break;
             case "attr":
             case "data":
             case "toggleClass":
             case "css":
               $(selector)[change](arg1, arg2);
               break;
             case "removeElse":
               var keep = $.html(selector);
               $ = cheerio.load(keep);
               break;
             default:
               throw new Error("Unknown html transform: " + change)
             }
           });

           return fs.makeTree(resolved)
                  .then(fs.write.bind(fs, destpath, $.html()));
         });
}
