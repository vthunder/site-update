#!/usr/bin/env node

var sitedir = undefined,
    config = undefined,
    zipfile = process.argv[2],
    actions = {},
    interpolate = require('interpolate'),
    path = require('path'),
    anymatch = require('anymatch'),
    Q = require('q'),
    fs = require('q-io/fs'),
    mime = require('mime'),
    temp = require('temp').track(),
    exec = require('child-process-promise').exec;

function findTopLevel() {
  return Q.all([fs.exists(path.join(process.cwd(), "site-update.json")),
                fs.exists(path.join(__dirname, "../..", "site-update.json"))])
         .spread(function(cwd, twoup) {
           if (cwd) {
             sitedir = process.cwd();
           } else if (twoup) {
             sitedir = path.absolute(path.join(__dirname, "../.."));
           } else {
             console.log("Could not find site-update.json file, have you created one?")
             if (__dirname.match(/^\/usr\/local\/bin/)) {
               console.log("It looks like site-update is installed globally,")
               console.log("so it can't find your module's toplevel dir.");
               console.log("cd there and try again.");
             }
             process.exit(1);
           }
           config = require(path.join(sitedir, "site-update.json"));
         });
}

function loadActions() {
  var builtin = path.resolve(__dirname, "lib/actions");
  var user = config.plugindir?
    path.resolve(sitedir, config.plugindir) : undefined;
  var load = function(dir, files) {
    if (dir) {
      files.forEach(function(file) {
        var action = require(path.join(dir, file));
        action.init({sitedir: sitedir});
        actions[action.name] = action;
      });
    }
  };
  return fs.list(builtin)
         .then(load.bind(null, builtin))
         .then(function() {
           if (user) {
             return fs.list(user)
                    .then(load.bind(null, user));
           }
           return undefined;
         });
}

function run() {
  fs.exists(zipfile)
  .then(function(exists) {
    if (!zipfile || !exists) {
      console.log("Usage: site-update <zip file>")
      process.exit(1);
    }
  })
  .then(findTopLevel)
  .then(loadActions)
  .then(tmpUnzip.bind(null, zipfile))
  .spread(function(tmpdir, zipResult) {
    return fs.listTree(tmpdir, function(file, stat) {
             // don't list directories, only their contents
             return !stat.isDirectory()
           });
  })
  .then(function(files) {
    var promises = [];
    files.forEach(function(file) {
      promises.push(processFile(file));
    });
    return Q.all(promises);
  })
  .then(function() {
    console.log("All done!");
  })
  .fail(function(error) {
    console.log("Error: ", error.message, error.stack);
  })
  .done();
}

function processFile(file) {

  // Find matching file config block
  var fileConfig =
    config.sources.filter(function(srcConfig) {
      return anymatch(srcConfig.match, file);
    });

  // Only first file config block to match applies. If none match, set
  // to an empty object, we'll use defaults later.
  if (fileConfig.length == 0) {
    fileConfig = {};
  } else {
    fileConfig = fileConfig[0];
  }

  if (Object.keys(fileConfig).length > 0 && !fileConfig.outputs) {
    // File is to be ignored, return immediately.
    return true;
  }

  var type = fileConfig.type || mime.lookup(file);
  var typeDefaults = config.type_defaults[type];

  console.log("Processing: ", path.basename(file));

  // Find appropriate defaults block if there wasn't an exact match
  if (!typeDefaults) {
    for (var typeglob in config.type_defaults) {
      if (anymatch(typeglob, type)) {
        typeDefaults = config.type_defaults[typeglob];
      }
    }
    if (!typeDefaults && Object.keys(fileConfig).length == 0) {
      // We couldn't find a type defaults block, or a file config block. Bail.
      throw new Error("No type config matching '" + file +
                      "' or defaults defined for type: " + type);
    }
  }

  // Make sure we loop on at least one config (an empty one, so we use
  // the defaults)
  var outputs = fileConfig.outputs || [{}];

  var promises = [];
  outputs.forEach(function(outputConfig) {
    // If we have an alt kind set, those settings override type
    // defaults (but not the output config)
    var kind = outputConfig.kind || typeDefaults.kind,
        kindConfig = {};
    if (typeDefaults.alt_kinds && typeDefaults.alt_kinds[kind]) {
      kindConfig = typeDefaults.alt_kinds[kind];
    }
    var configs = [outputConfig, fileConfig, kindConfig, typeDefaults];

    // finally! ready to go
    promises.push(runOutputAction(file, configs));
  });

  return Q.all(promises);
}

function searchAndInterpolate(searchObjects, interpolationVars, searchKey) {
  var value = objSearch(searchObjects, searchKey);
  if (typeof(value) == "string") {
    value = interpolate(value, interpolationVars);
  }
  return value;
}

function runOutputAction(file, configs) {
  var stringvars = {
    sitedir: sitedir,
    fullname: path.basename(file),
    extname: path.extname(file),
    basename: path.basename(file, path.extname(file))
  };
  var configLookup = searchAndInterpolate.bind(null, configs, stringvars),
      action = actions[configLookup("action")];

  if (!action) {
    throw new Error("Unknown action '" + configLookup("action"));
  }

  return action.run(file, configLookup);
}

function tmpUnzip(zip) {
  return Q.nfcall(temp.mkdir, 'site-update')
         .then(function(tmpdir) {
           return exec("unzip -o -u " + zipfile + " -d \"" + tmpdir + "\"")
                  .then(function(result) {
                    return [tmpdir, result];
                  });
         });
}

function objSearch(objects, key) {
  var value = undefined;
  objects.some(function(obj) {
    if (obj[key]) {
      value = obj[key];
      return true; // stop looking
    }
    return false;
  });
  return value;
}

// kick things off
run();
