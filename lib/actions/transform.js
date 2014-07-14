var path = require('path'),
    util = require('util'),
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

  console.log("  ->", destname, "(transform)");

  return fs.read(srcfile)
         .then(function(content) {
           var $ = cheerio.load(content, {decodeEntities: false});

           config("transform").forEach(function(transform) {
             var selector = transform[0],
                 change = transform[1],
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
               if (util.isArray(arg1)) {
                 $(selector)[change](arg1.join('\n'));
               } else {
                 $(selector)[change](arg1);
               }
               break;
             case "attr":
             case "data":
             case "toggleClass":
             case "css":
               if (util.isArray(arg2)) {
                 $(selector)[change](arg1, arg2.join());
               } else {
                 $(selector)[change](arg1, arg2);
               }
               break;
             case "removeElse":
               var keep = $.html(selector);
               $ = cheerio.load(keep, {decodeEntities: false});
               break;
             case "copyTo":
               $(arg1).html($.html(selector));
               break;
             case "moveTo":
               $(arg1).html($.html(selector));
               $(selector).remove();
               break;
             default:
               throw new Error("Unknown html transform: " + change)
             }
           });

           // replace is a workaround for
           // https://github.com/cheeriojs/cheerio/issues/526
           return fs.makeTree(resolved)
                  .then(fs.write.bind(fs, destpath, $.html()));
         });
}
