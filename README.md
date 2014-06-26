# site-update

`site-update` is a script that you can configure to take apart a
zipfile with upstream sources for your site (html, css, js, etc), and
integrate it into your site. This is particularly useful if you
develop pages using design tools like [Webflow][] but want to host
them yourself *with modifications*.

If you modify the upstream files (e.g., split pages into reusable
components), re-importing a newer version is a horrible error-prone
task. Rather than doing it by hand, `site-update` allows you to
**describe** the changes, so that importing a new zipfile is as easy
as running the command again. In fact, I have my laptop set-up to
detect when I download a new zipfile, and it automatically kicks off
an update.

See the sample folder for a complete config file. Below is a
description of the sections and how they work.

[Webflow]: http://webflow.com/

## Installation

    npm install site-update

It's best to install locally (without -g), because that allows the
script to find your project's toplevel folder regardless of your
current directory.

If you do install globally, cd into your project to run
`site-update`.

## Usage

After you've created a config file (see section below), you just need
to run it on a zipfile containing the sources you want integrated:

    path-to-project/node_modules/.bin/site-update ~/Downloads/mysite.zip

You can put it in your PATH so you don't need to specify the
folder. Or if you installed with `-g`:

    cd path-to-project
    site-update ~/Downloads/mysite.zip

## Config file

The config file must be at the top-level of your project folder, and
must be called `site-update.json`.

The config file has two main sections, "type_defaults", which contains
default actions by file type, and "sources", which lets you override
those defaults based on file names/paths.

### Type Defaults

Type defaults describe the defaults for a particular file type. Here's
a complete example for HTML files:

        "text/html": {
            "kind": "view",
            "destdir": "views",
            "destname": "{basename}.hbs",
            "action": "transform",
            "transform": [],
            "alt_kinds": {
                "layout": {
                    "destdir": "views/layouts"
                },
                "partial": {
                    "destdir": "views/partials"
                }
            }
        },

#### text/html

The property name is the mime type of the file these settings apply
to. It can be a glob, such as `image/*` to set defaults for all
images.

Note that since the type defaults are not evaluated in any particular
order, if two globs that match the same type, there is no guarantee
which one will be used. However, an exact match will always be tried
first. e.g., `image/png` will be attempted before `image/*` is
matched.

#### kind & alt_kinds

'Kinds' allow you to specify multiple variants of a default. For HTML
files, a good example is (as above) views, layouts, and partials. All
are essentially the same, and are split from the same HTML files--but
each gets placed into its own folder.

In this example, only `destdir` is being overridden, but each
`alt_kind` section may override any of the defaults.

#### destdir

Where you want files to end up, relative to the top of your project.

#### destname

What you want files to be named. The example above uses a variable
that gets substituted for the file being processed. See the
Substitution Variables section below for a complete list.

#### action

What you want `site-update` to do. There are currently only two values:

* `copy`: copies the file as-is.
* `transform`: parses the file as HTML and runs transform rules
  before writing out the file.

#### transform

Array containing transform rules to be applied on HTML files before
writing them out. Only applies when `action` is set to
`transform`.

See Transform Actions below for more information on the format and
what you can do.

### Sources

This section is ***an array*** which allows you to match files based
on filename or path. Rules are matched in order, so place more generic
rules (e.g., catch-alls like `[**/*html]` or `[**]`) below. Only the
first rule to match is used. Here's an example:

        {
            "match": ["**/index.html"],
            "type": "text/html",
            "outputs": [
                {
                    "kind": "view",
                    "destdir": "views",
                    "destname": "webflow-{basename}.hbs",
                    "action": "transform",
                    "transform": [
                        ["remove", "body > .navbar"],
                        ["remove", "body > .footer"],
                        ["removeElse", "body > div"]
                    ]
                },
                {
                    "kind": "partial",
                    "destname": "navbar.hbs",
                    "transform": [
                        ["removeElse", "body > .navbar"]
                    ]
                }
        }

#### match

An anymatch expression to match the file(s) you wish to act on. In
this case, it will match 'index.html'.

#### type

*optional*

Allows overriding the default mime type for a file.

#### outputs

An array of objects, each corresponding to a file being output. In
this case, index.html is being split into two files:
`webflow-index.hbs` (a view), and `navbar.hbs` (a
partial). You can split an input file into as many files as you wish.

Each object has the same options that type defaults have, see Type
Defaults above for more information on each one.

### Substitution Variables

Config settings are allowed to contain a few variables which get
substituted. This is useful for setting defaults that apply to several
files. Current set of variables is:

#### fullname

The full filename (without the path). For example, given the file
`/foo/bar/index.html`, the {fullname} variable will expand to
`index.html`.

#### extname

The file extension, with leading dot. For example, given the file
`/foo/bar/index.html`, the {extname} variable will expand to
`.html`.

#### basename

The filename minus the extension. For example, given the file
`/foo/bar/index.html`, the {basename} variable will expand to
`index`.

### Transform Actions

Transform rules are only valid for HTML files, and are directly based
on [Cheerio][]. Currently, only a small subset is implemented, however
(only what I've needed so far). See below for a list.

[Cheerio]: https://github.com/cheeriojs/cheerio

Rules are arrays with two or three items:

1. Transform action
2. Selector to act on
3. (Optionally) Additional data

Perhaps some examples will make it clear. From the `index.html`
example above:

                    "transform": [
                        ["remove", "body > .navbar"],
                        ["remove", "body > .footer"],
                        ["removeElse", "body > div"]
                    ]

These rules do the following:

1. Remove element(s) with the `navbar` class that are inside `body`.
2. Remove element(s) with the `footer` class that are inside `body`.
3. Keep `div` elements currently inside `body`, but delete everything else.

So if you started with something like:

```
<html>
<head>
...
</head>
<body>
<div class="navbar"></div>
<div><h1>some content</h1></div>
</body>
</html>
```

You would end up with:

```
<div><h1>some content</h1></div>
```

Neat!

In addition to removal, you can also add and replace content. In that
case, the transform array needs a third item, which is the content to
add.

I find it particularly useful to replace elements with partial
includes. For example, split scripts into a separate file called
`upstream-scripts.hbs`, then replace them with `{{>
scripts}}`. Then I can maintain `scripts.hbs` myself, and
include `upstream-scripts` or not as I wish.

Here's what's currently implemented:

#### remove

Removes matched elements.

#### removeElse

Keeps only the matched elements (removes everything else).

#### empty

Keeps the matched elements, but empties out their contents.

#### replace

Replaces the matched elements with the given content.

Note that the replacement content will be added for each matched
element, not just once.

#### append

Appends content, at the end of the element (inside it).

#### prepend

Prepends content, at the beginning of the element (inside it).

## Copyright & License

This work is distributed under an [MIT][] style license.

Copyright (c) 2014 [56 degrees LLC](56degrees)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

[MIT]: http://opensource.org/licenses/MIT
[56degrees]: http://56degre.es/
