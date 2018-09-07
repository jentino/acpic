(function () {

   // *** SETUP ***

   var dale = window.dale, teishi = window.teishi, lith = window.lith, c = window.c, B = window.B;
   var type = teishi.t, log = teishi.l;

   // *** LOGGING ***

   B.forget ('eventlog');

   B.listen ({id: 'eventlog', verb: '*', path: [], priority: 1}, function (x) {
      B.eventlog.unshift ({verb: x.verb, path: x.path, from: x.from});
      if (arguments.length > 1) B.eventlog [0].args = [].slice.call (arguments, 1);
      if (! B.verbose) return;
      var toprint = ['event #' + B.eventlog.length, B.eventlog [0].verb, B.eventlog [0].path];
      if (dale.keys (B.eventlog [0]).indexOf ('args') !== -1) toprint.push (JSON.stringify (B.eventlog [0].args).slice (0, 500));
      if (B.eventlog [0].from [1]) {
         toprint.push ('FROM');
         dale.do (['ev', 'verb', 'path'], function (i) {
            if (B.eventlog [0].from [1].verb && 'ev' === i) return;
            if (B.eventlog [0].from [1] [i]) toprint.push (B.eventlog [0].from [1] [i]);
            if (dale.keys (B.eventlog [0].from [1]).indexOf ('args') !== -1) toprint.push (JSON.stringify (B.eventlog [0].from [1].args).slice (0, 500));
         });
      }
      console.log.apply (console, toprint);
   });

   B.verbose = true;

   // *** INITIALIZATION OF STATE ***

   B.do ({from: {ev: 'initialize'}}, 'set', 'Data',  {});
   B.do ({from: {ev: 'initialize'}}, 'set', 'State', {});
   window.Data = B.get ('Data'), window.State = B.get ('State');

   // *** NAVIGATION ***

   B.listen ('change', 'hash', function (x) {
      var path = window.location.hash.replace ('#/', '').split ('/');
      B.do (x, 'set', ['State', 'view'],    path [0]);
      B.do (x, 'set', ['State', 'subview'], path [1]);
   });

   B.listen ('change', ['State', '*'], function (x) {
      if (x.path [1] !== 'view' && x.path [1] !== 'subview') return;
      var view = B.get ('State', 'view');
      var cookie = c.cookie () ? c.cookie () [COOKIENAME] : undefined;
      if (! cookie && view !== 'auth') return B.do (x, 'set', ['State', 'view'], 'auth');
      if (cookie   && view !== 'main') return B.do (x, 'set', ['State', 'view'], 'main');
      window.location.hash = ['#', B.get ('State', 'view'), B.get ('State', 'subview')].join ('/');
   });

   window.addEventListener ('hashchange', function () {
      B.do ({from: {ev: 'hashchange'}}, 'change', 'hash')
   });

   // *** ERROR REPORTING ***

   window.onerror = function () {
      var payload = dale.do (arguments, function (v) {
         return v.toString ();
      });
      c.ajax ('post', 'api/error', {}, payload);
   }

   // *** INITIALIZATION ***

   c.ready (function () {
      B.do ({from: {ev: 'ready'}}, 'change', 'hash');
      B.mount ('body', Views.base ({from: {ev: 'ready'}}));
   });

   // *** HELPERS ***

   var H = {};

   H.logout = function () {
      B.eventlog = [];
      B.do ({from: {ev: 'logout'}}, 'set', 'Data',  {});
      B.do ({from: {ev: 'logout'}}, 'set', 'State', {});
      window.Data = B.get ('Data'), window.State = B.get ('State');
      c.cookie (false);
      B.do ({from: {ev: 'logout'}}, 'set', ['State', 'view'], 'auth');
   }

   H.authajax = function (x, m, p, h, b, cb) {
      return c.ajax (m, p, h, b, function (error, rs) {
         if (error && error.status === 403) {
            H.logout ();
            return B.do (x, 'notify', 'red', 'Your session has expired. Please login again.', error.responseText);
         }
         cb (error, rs);
      });
   }

   H.picPath = function (pic, size) {
      if (! size && pic.t200) return 'thumb/' + pic.t200;
      if (pic.t900) return 'thumb/' + pic.t900;
      return 'pic/' + pic.id;
   }

   H.fullScreen = function (exit) {
      // https://www.sitepoint.com/use-html5-full-screen-api/
      // https://stackoverflow.com/a/10082234
      if (! exit) {
         dale.do (['requestFullScreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'], function (v) {
            if (type (document.documentElement [v]) === 'function') document.documentElement [v] ();
         });
         if (window.ActiveXObject) {
            var wscript = new ActiveXObject ('WScript.Shell');
            if (wscript) wscript.SendKeys ('{F11}');
         }
      }
      else {
         dale.do (['exitFullScreen', 'webkitExitFullscreen', 'mozCancelFullScreen', 'msExitFullscreen'], function (v) {
            if (type (document [v]) === 'function') document [v] ();
         });
         if (window.ActiveXObject) {
            var wscript = new ActiveXObject ('WScript.Shell');
            if (wscript) wscript.SendKeys ('{ESC}');
         }
      }
   }

   // *** VIEWS ***

   var Views = {};

   Views.base = function (x) {
      return B.view (x, ['State', 'view'], function (x, view) {
         return ['div', {class: 'pure-g'}, [
            Views.canvas (x),
            ['div', {class: 'pure-u-1-24'}],
            ['div', {class: 'pure-u-22-24'}, [
               Views.notify (x),
               Views [view] ? Views [view] (x) : undefined],
            ],
            ['div', {class: 'pure-u-1-24'}],
          ]];
      });
   }

   // *** NOTIFY ***

   Views.notify = function (x) {
      return B.view (x, ['State', 'notify'], {listen: [
         ['notify', '*', function (x, message, notimeout) {
            if (B.get ('State', 'notify', 'timeout')) clearTimeout (B.get ('State', 'notify', 'timeout'));
            B.do (x, 'set', ['State', 'notify'], {color: x.path [0], message: message});
            if (! notimeout) B.do (x, 'set', ['State', 'notify', 'timeout'], setTimeout (function () {
               B.do (x, 'rem', 'State', 'notify');
            }, 3000));
         }],
      ]}, function (x, notify) {
         if (! notify) return;
         var colormap = {red: '#ff0033'};
         return [
            ['style', [
               ['div.notify', {
                  position: 'fixed',
                  'bottom, left': 0,
                  margin: '0 auto',
                  color: 'white',
                  border: 'solid 4px ' + (colormap [notify.color] || notify.color),
                  'background-color': '#333333',
                  height: '1.6em',
                  width: 1,
                  'z-index': '2',
                  padding: '0.5em',
                  opacity: notify ? 1 : 0,
                  'text-align': 'center',
                  'font-size': '1.2em'
               }]
            ]],
            ['div', B.ev ({class: 'notify'}, ['onclick', 'rem', 'State', 'notify']), notify.message],
         ];
      });
   }

   // *** AUTH ***

   Views.auth = function (x) {
      return B.view (x, ['State', 'subview'], {listen: [
         ['submit', 'auth', function (x) {
            var creds = {
               username: c ('#auth-username').value,
               password: c ('#auth-password').value
            };
            c.ajax ('post', 'auth/' + B.get ('State', 'subview'), {}, creds, function (error, rs) {
               if (error) return B.do (x, 'notify', 'red', 'There was an error ' + (B.get ('State', 'subview') === 'signup' ? 'signing up.' : 'logging in.'));
               else              B.do (x, 'notify', 'green', 'Welcome!');
               dale.do (rs.headers, function (v, k) {
                  if (k.match (/^cookie/i)) document.cookie = v;
               });
               B.do (x, 'set', ['State', 'view'], 'main');
            });
         }],
      ], ondraw: function (x) {
         if (['login', 'signup'].indexOf (B.get ('State', 'subview')) === -1) B.do (x, 'set', ['State', 'subview'], 'login');
      }}, function (x, subview) {
         return [
            ['style', [
               ['label', {width: 80, display: 'inline-block'}]
            ]],
            ['form', {class: 'pure-form pure-form-aligned', onsubmit: 'event.preventDefault ()'}, [
               ['fieldset', [
                  ['legend', subview],
                  ['br'],
                  dale.do (['Username', 'Password'], function (V) {
                     var v = V.toLowerCase ();
                     return ['div', {class: 'pure-control-group'}, [
                        ['label', {for: v}, V],
                        ['input', {id: 'auth-' + v, type: v === 'password' ? v : 'text', placeholder: v}]
                     ]];
                  }),
                  ['div', {class: 'pure-controls'}, [
                     ['button', B.ev ({class: 'pure-button pure-button-primary'}, ['onclick', 'submit', 'auth']), 'Submit'],
                     ['br'], ['br'],
                     subview === 'login' ? ['a', {href: '#/auth/signup'}, 'Don\'t have an account yet? Create one.']
                                         : ['a', {href: '#/auth/login'},  'Already have an account? Log in.'],
                  ]]
               ]]
            ]]
         ]
      });
   }

   // *** MAIN VIEW ***

   Views.main = function (x) {
      return B.view (x, ['State', 'subview'], {listen: [
         ['change', ['State', 'upload', 'queue'], function (x) {
            var queue = B.get ('State', 'upload', 'queue');
            var MAXSIMULT = 2, uploading = 0;
            // XXX uploading must be in the state
            dale.do (queue, function (file) {
               if (uploading === MAXSIMULT) return;
               if (file.uploading) return uploading++;
               file.uploading = true;
               uploading++;
               (function () {
                  var f = new FormData ();
                  f.append ('lastModified', file.lastModified);
                  f.append ('pic', file);
                  H.authajax (x, 'post', 'pic', {}, f, function (error, rs) {
                     if      (error && error.responseText !== 'repeated') B.do (x, 'add', ['State', 'upload', 'error'], file);
                     else if (error && error.responseText === 'repeated') B.do (x, 'set', ['State', 'upload', 'repeated', file.name], true);
                     else                                                 B.do (x, 'add', ['State', 'upload', 'done'], rs.body);
                     dale.do (B.get (['State', 'upload', 'queue']), function (v, i) {
                        if (v === file) B.do (x, 'rem', ['State', 'upload', 'queue'], i);
                     });
                  });
               }) ();
            });
         }],
      ], ondraw: function (x) {
         if (['browse', 'upload'].indexOf (B.get ('State', 'subview')) === -1) B.do (x, 'set', ['State', 'subview'], 'browse');
         window.onbeforeunload = function () {
            var q = B.get ('State', 'upload', 'queue');
            if (q && q.length > 0) return 'Refreshing the page will stop the upload process. Are you sure?';
         }
         var from = function (x, o) {
            x.from.unshift (o);
            return x;
         }
         dale.do (['webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', 'MSFullscreenChange'], function (v) {
            document.addEventListener (v, function () {
               if (! document.fullscreenElement && ! document.webkitIsFullScreen && ! document.mozFullScreen && ! document.msFullscreenElement) {
                  B.do (from (x, {ev: 'onkeydown', key: 27}), 'rem', 'State', 'canvas');
               }
            });
         });
         document.onkeydown = function (e) {
            e = e || window.event;
            if (e.keyCode === 16) B.do (from (x, {ev: 'onkeydown', key: 16}), 'set', ['State', 'shift'], true);
            if (e.keyCode === 17) B.do (from (x, {ev: 'onkeydown', key: 17}), 'set', ['State', 'ctrl'],  true);
            return true;
         };
         document.onkeyup = function (e) {
            e = e || window.event;
            if (e.keyCode === 16) B.do (from (x, {ev: 'onkeyup', key: 16}), 'set', ['State', 'shift'], false);
            if (e.keyCode === 17) B.do (from (x, {ev: 'onkeyup', key: 17}), 'set', ['State', 'ctrl'],  false);
            return true;
         };
      }}, function (x, subview) {
         return [
            ['style', [
               ['body', {
                  'background-color': '#dddddd',
                  'background-image': "url(\"data:image/svg+xml,%3Csvg width='24' height='20' viewBox='0 0 24 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 18c0-1.105.887-2 1.998-2 1.104 0 2-.895 2.002-1.994V14v6h-4v-2zM0 13.998C0 12.895.888 12 2 12c1.105 0 2 .888 2 2 0 1.105.888 2 2 2 1.105 0 2 .888 2 2v2H0v-6.002zm16 4.004A1.994 1.994 0 0 1 14 20c-1.105 0-2-.887-2-1.998v-4.004A1.994 1.994 0 0 0 10 12c-1.105 0-2-.888-2-2 0-1.105-.888-2-2-2-1.105 0-2-.887-2-1.998V1.998A1.994 1.994 0 0 0 2 0a2 2 0 0 0-2 2V0h8v2c0 1.105.888 2 2 2 1.105 0 2 .888 2 2 0 1.105.888 2 2 2 1.105 0 2-.888 2-2 0-1.105.888-2 2-2 1.105 0 2-.888 2-2V0h4v6.002A1.994 1.994 0 0 1 22 8c-1.105 0-2 .888-2 2 0 1.105-.888 2-2 2-1.105 0-2 .887-2 1.998v4.004z' fill='%23eeeeee' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E\")"
               }],
               ['a.logout', {
                  'letter-spacing': 'normal',
                  position: 'absolute',
                  left: 0.05,
                  top: 0.05,
                  'font-weight': 'bold',
                  'text-decoration': 'none'
               }],
               ['span.action', {
                  color: 'blue',
                  'text-decoration': 'underlined',
                  cursor: 'pointer'
               }],
               ['.icon', {
                  position: 'absolute',
                  cursor: 'pointer',
               }],
               ['.thumb', {
                  float: 'left',
                  position: 'relative',
                  width: 210,
                  height: 210,
                  padding: 2,
                  border: 'solid 1px #dddddd',
                  'border-right': 0
               }, [
                  ['img', {
                     position: 'absolute',
                     margin: 'auto',
                     'top, left, right, bottom': 0
                  }],
                  ['.icon', {
                     right: 2,
                     top: 2,
                     'font-size': '1.5em',
                     display: 'none',
                     color: '#ff8080',
                  }]
               ]],
               ['.thumb:hover .icon', {display: 'block'}],
               ['a.buttonlink', {
                  color: 'white',
                  'text-decoration': 'none'
               }],
               ['topspace', {
                  'min-height': 0.14,
                  overflow: 'auto'
               }],
            ]],
            Views [subview] ? Views [subview] (x) : undefined,
         ]
      });
   }

   // *** MANAGE VIEW ***

   Views.manage = function (x) {
      return B.view (x, ['Data', 'tags'], {listen: [
         ['delete', 'pics', function (x) {
            var pics = dale.fil (B.get ('Data', 'pics'), undefined, function (pic) {
               if (pic.selected) return pic.id;
            });
            if (pics.length === 0) return;
            if (! confirm ('Are you sure you want to delete the selected pictures?')) return;
            B.do (x, 'notify', 'yellow', 'Deleting, please wait...');
            var deleteOne = function () {
               H.authajax (x, 'delete', 'pic/' + pics.shift (), {}, '', function (error, rs) {
                  if (error) return B.do (x, 'notify', 'red', 'There was an error deleting the picture(s).', error.responseText);
                  if (pics.length > 0) deleteOne ();
                  else {
                     B.do (x, 'retrieve', 'tags');
                     B.do (x, 'retrieve', 'pics');
                     B.do (x, 'notify', 'green', 'The pictures were successfully deleted.');
                  }
               });
            }
            deleteOne ();
         }],
         ['retrieve', 'tags', function (x) {
            H.authajax (x, 'get', 'tags', {}, '', function (error, rs) {
               if (error) return B.do (x, 'notify', 'red', 'There was an error querying the tags.', error.responseText);
               B.do (x, 'set', ['Data', 'tags'], rs.body);
               var tags = dale.keys (rs.body);
               dale.do (B.get ('State', 'query', 'tags') || [], function (tag, k) {
                  if (tags.indexOf (tag) === -1) B.do (x, 'rem', ['State', 'query', 'tags'], k);
               });
            });
         }],
         ['tag', 'pics', function (x, tag, del) {
            if (tag == true) tag = B.get ('State', 'autotag');
            if (! tag) return;
            if (BASETAGS.indexOf (tag) !== -1) return B.do (x, 'notify', 'yellow', 'Sorry, you can not use that tag.');
            if (tag.match (/^\d{4}$/) && parseInt (tag) > 1899 && parseInt (tag) < 2101) return B.do (x, 'notify', 'yellow', 'Sorry, you can not use that tag.');
            var payload = {
               tag: tag,
               ids: dale.fil (B.get ('Data', 'pics'), undefined, function (v) {if (v.selected) return v.id}),
               del: del
            }
            H.authajax (x, 'post', 'tag', {}, payload, function (error, rs) {
               if (error) return B.do (x, 'notify', 'red', 'There was an error tagging the picture(s).', error.responseText);
               B.do (x, 'notify', 'green', B.get ('State', 'action') + ' operation successful!');
               B.do (x, 'retrieve', 'tags');
               B.do (x, 'change', ['State', 'query', 'tags']);
               B.do (x, 'rem', 'State', 'autotag');
               B.do (x, 'rem', 'State', 'action');
            });
         }],
         ['unselect', 'pics', function (x) {
            dale.do (B.get ('Data', 'pics'), function (pic, k) {
               if (pic.selected) B.set (['Data', 'pics', k, 'selected'], false);
            });
            B.do (x, 'change', ['Data', 'pics']);
         }]
      ], ondraw: function (x) {
         if (! B.get ('Data', 'tags')) B.do (x, 'retrieve', 'tags');
      }, onforget: function (x) {
         B.do (x, 'rem', 'State', 'query', 'tags');
         B.do (x, 'rem', 'Data', 'tags');
      }}, function (x, tags) {
         return B.view (x, ['Data', 'pics'], function (x, pics) {
            pics = dale.fil (pics, undefined, function (v) {
               if (type (v) === 'integer') return;
               if (v.selected) return v;
            });
            if (pics.length === 0) return;
            var picn = pics.length === 1 ? 'picture' : 'pictures';
            return [
               ['h3', 'Manage pics'],
               ['h4', [
                  [pics.length, ' ', picn, ' selected - '],
                  ['span', B.ev ({class: 'action'}, ['onclick', 'unselect', 'pics']), 'Unselect all']
               ]],
               ['hr'],
               B.view (x, ['State', 'action'], function (x, action) {
                  if (! action) return [
                     ['br'],
                     ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary'}, ['onclick', 'set', ['State', 'action'], 'tag']), 'Tag ' + picn],
                     ['br'], ['br'],
                     ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary', style: 'background: rgb(223, 117, 20);'}, ['onclick', 'set', ['State', 'action'], 'untag']), 'Untag ' + picn],
                     ['br'], ['br'],
                     ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary', style: 'background: rgb(123, 217, 20);'}, [
                        ['onclick', 'set', ['State', 'action'], 'rotate'],
                        ['onclick', 'set', ['State', 'rotate'], 90],
                     ]), 'Rotate ' + picn],
                     ['br'], ['br'],
                     ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary', style: 'background: rgb(202, 60, 60);'}, ['onclick', 'delete', 'pics']), 'Delete ' + picn + ' permanently'],
                  ];

                  if (action === 'untag') {
                     var tags = {};
                     var selected = dale.fil (pics, undefined, function (pic) {
                        if (pic.selected) {
                           dale.do (pic.tags, function (tag) {
                              tags [tag] = tags [tag] ? tags [tag] + 1 : 1;
                           });
                           return pic;
                        }
                     });
                     return [
                        dale.keys (tags).length === 0 ?
                           ['p', 'None of the selected pictures have tags.'] :
                           dale.do (tags, function (card, tag) {
                              return ['p', [tag + ':', ['span', B.ev ({class: 'action'}, ['onclick', 'tag', 'pics', tag, true]), ' Untag ' + card + (card === 1 ? ' picture' : ' pictures')]]];
                           }),
                        ['button', B.ev ({type: 'submit', class: 'pure-button'}, ['onclick', 'rem', 'State', 'action']), 'Cancel']
                     ];
                  }

                  if (action === 'tag') {return [
                     B.view (x, ['State', 'autotag'], {listen: [
                        ['trigger', 'tag', function (x, ev) {
                           if (ev.keyCode === 13) B.do (x, 'tag', 'pics', B.get ('State', 'autotag'));
                        }],
                     ]}, function (x, autotag) {
                        var matches = ! autotag ? [] : dale.fil (B.get ('Data', 'tags'), undefined, function (card, tag) {
                           if (BASETAGS.indexOf (tag) === -1 && tag.match (autotag)) return [tag, card];
                        });
                        return [
                           ['input', B.ev ({class: 'autocomplete', placeholder: 'tag ' + picn, value: autotag}, [
                              ['oninput', 'set', ['State', 'autotag']],
                              ['onkeydown', 'trigger', 'tag', {rawArgs: 'event'}]
                           ])],
                           matches.length === 0 ? [] : ['ul', {class: 'autocomplete'}, dale.do (matches, function (match) {
                              return ['li', B.ev ({}, [
                                 ['onclick', 'tag', 'pics', match [0]]
                              ]), match [0] + ' (' + match [1] + ' pics)']
                           })],
                           ['br'], ['br'],
                           ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary'}, ['onclick', 'tag', 'pics', true]), 'Tag ' + picn],
                           ['button', B.ev ({type: 'submit', class: 'pure-button'}, ['onclick', 'rem', 'State', 'action']), 'Cancel']
                        ];
                     }),
                  ]}

                  if (action === 'rotate') {return B.view (x, ['Data', 'pics'], {listen: [
                     ['rotate', 'pics', function (x) {
                        var pics = dale.fil (B.get ('Data', 'pics'), undefined, function (pic, k) {
                           if (pic.selected) return pic.id;
                        });
                        if (pics.length === 0) return;
                        B.do (x, 'notify', 'yellow', 'Rotating, please wait...', true);
                        var rotateOne = function () {
                           H.authajax (x, 'post', 'rotate', {}, {deg: B.get ('State', 'rotate'), id: pics.shift ()}, function (error, data) {
                              if (error) return B.do (x, 'notify', 'red', 'There was an error rotating the picture(s).', error.responseText);
                              if (pics.length > 0) return rotateOne ();
                              B.do (x, 'rem', 'State', 'action');
                              B.do (x, 'retrieve', 'pics');
                              B.do (x, 'notify', 'green', 'The pictures were successfully rotated.');
                           });
                        }
                        rotateOne ();
                     }]
                  ]}, function (x, pics) {
                     var firstSelected = dale.stopNot (pics, undefined, function (pic) {
                        if (pic.selected) return pic;
                     });
                     return B.view (x, ['State', 'rotate'], function (x, rotate) {return [
                        ['span', B.ev ({class: rotate === -90 ? 'bold' : 'action'}, ['onclick', 'set', ['State', 'rotate'], -90]), 'Rotate left'],
                        ' / ',
                        ['span', B.ev ({class: rotate === 90 ? 'bold' : 'action'}, ['onclick', 'set', ['State', 'rotate'], 90]), 'Rotate right'],
                        ' / ',
                        ['span', B.ev ({class: rotate === 180 ? 'bold' : 'action'}, ['onclick', 'set', ['State', 'rotate'], 180]), 'Invert'],
                        ['br'], ['br'], ['br'], ['br'],
                        ['style', [
                           ['span.bold', {'font-weight': 'bold'}],
                           ['img.rotate', {
                              'transform, -ms-transform, -webkit-transform, -moz-transform': 'rotate(' + (rotate || 0) + 'deg)',
                              'max-height, max-width': 130
                           }]
                        ]],
                        ['div', {style: 'height: 200px, width: 200px'}, ['img', {class: 'rotate pure-img', src: H.picPath (firstSelected)}]],
                        ['br'], ['br'], ['br'], ['br'],
                        ['button', B.ev ({class: 'pure-button pure-button-primary'}, ['onclick', 'rotate', 'pics']), 'Rotate'],
                        ['button', B.ev ({type: 'submit', class: 'pure-button'}, ['onclick', 'rem', 'State', 'action']), 'Cancel']
                     ]});
                  })}
               }),
            ];
         });
      });
   }

   // *** QUERY VIEW ***

   Views.query = function (x) {return [
      ['style', [
         ['input.autocomplete, ul.autocomplete', {
            width: 0.6,
            padding: 5
         }],
         ['ul.autocomplete', {
            border: 'solid 1px #cccccc',
            margin: 0,
            padding: 5
         }, [
            ['li', {
               'list-style-type': 'none',
            }],
            ['li:hover', {
               color: 'white',
               'background-color': 'blue'
            }]
         ]],
         ['ul.search', {
            'margin, padding': 0,
         }, [
            ['li', {
               float: 'left',
               padding: 6,
               'margin-bottom': 3,
               'list-style-type': 'none',
               'margin-right': 5,
               border: 'solid 1px #dddddd',
               'border-radius': 5
            }, [
               ['span', {
                  color: '#0073ea'
               }],
               ['i', {'font-size': '0.8em', 'margin-left': 3}]
            ]]
         ]],
      ]],
      B.view (x, ['State', 'query'], {ondraw: function (x) {
         if (! B.get ('State', 'query')) {
            B.do (x, 'set', ['State', 'query'], {tags: [], sort: 'newest'});
         }
         if (! B.get ('State', 'refreshQuery')) {
            B.do (x, 'set', ['State', 'refreshQuery'], setInterval (function () {
               var queue = B.get ('State', 'upload', 'queue');
               if (queue && queue.length > 0) B.do ({from: {ev: 'setInterval', path: ['State', 'refreshQuery']}}, 'retrieve', 'pics');
            }, 1000));
         }
      }, listen: [
         ['change', ['State', 'query'], function (x) {
            B.do (x, 'set', ['Data', 'pics'], []);
            B.do (x, 'retrieve', 'pics');
         }],
         ['retrieve', 'pics', function (x) {
            var q = B.get ('State', 'query');
            if (! q) return;
            var num = (B.get ('Data', 'pics') || []).length;

            H.authajax (x, 'post', 'query', {}, {tags: q.tags, sort: q.sort, from: 1, to: num + 30}, function (error, rs) {
               if (error) return B.do (x, 'notify', 'red', 'There was an error querying the picture(s).', error.responseText);
               B.do (x, 'set', ['Data', 'years'], rs.body.years);
               var selected = dale.obj (B.get ('Data', 'pics'), function (oldpic) {
                  if (oldpic.selected) return [oldpic.id, true];
               });
               dale.do (rs.body.pics, function (newpic) {
                  if (selected [newpic.id]) newpic.selected = true;
               });
               B.do (x, 'set', ['Data', 'pics'], rs.body.pics);
            });
         }]
      ]}, function (x, query) {
         return B.view (x, ['Data', 'pics'], function (x, pics) {
            var selectedPics = dale.fil (B.get ('Data', 'pics'), undefined, function (p) {if (p.selected) return p}).length;
            if (selectedPics > 0) return;
            return ['div', {class: 'pure-g'}, [
            ['div', {class: 'pure-u-5-5'}, [
               ['h3', 'Search pics'],
               ['p', [
                  ! query || query.sort === 'newest' ? 'By newest' : ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'query', 'sort'], 'newest']), 'By newest'],
                  [' | '],
                  query && query.sort === 'oldest' ? 'By oldest' : ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'query', 'sort'], 'oldest']), 'By oldest'],
                  [' | '],
                  query && query.sort === 'upload' ? 'By upload date' : ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'query', 'sort'], 'upload']), 'By upload date'],
               ]],
               ['ul', {class: 'search'}, [
                  dale.do (query ? query.tags : [], function (tag, k) {
                     if (tag === 'all') return;
                     return [
                        ['li', [
                           ['span', tag],
                           ['i', B.ev ({class: 'ion-close'}, ['onclick', 'rem', ['State', 'query', 'tags'], k])],
                        ]],
                     ];
                  }),
               ]],
            ]],
            B.view (x, ['State', 'autoquery'], {attrs: {class: 'pure-u-5-5'}}, function (x, query) {
               var matches = ! query ? [] : dale.fil (dale.keys (B.get ('Data', 'tags')).concat (B.get ('Data', 'years') || []), undefined, function (tag) {
                  if (tag !== 'all' && (tag + '').match (new RegExp (query, 'i')) && (B.get ('State', 'query', 'tags') || []).indexOf (tag) === -1) return tag;
               });

               return [
                  ['input', B.ev ({class: 'autocomplete', placeholder: 'search pics by tag or year', value: query}, ['oninput', 'set', ['State', 'autoquery']])],
                  matches.length > 0 ? ['ul', {class: 'autocomplete'}, dale.do (matches, function (match) {
                     return ['li', B.ev ({}, [
                        ['onclick', 'add', ['State', 'query', 'tags'], match + ''],
                        ['onclick', 'rem', 'State', 'autoquery']
                     ]), match];
                  })] : [],
               ];
            }),
         ]]})
      })
   ]}

   // *** BROWSE VIEW ***

   Views.browse = function (x) {
      return [
         ['div', {class: 'pure-g'}, [
            ['div', {class: 'pure-u-5-24'}, [
               ['div', {style: 'position: fixed'}, [
                  ['a', {class: 'logout', onclick: 'H.logout ()', href: 'auth/logout'}, 'Logout'],
                  ['br'], ['br'],
                  ['br'], ['br'],
                  ['a', {class: 'buttonlink', href: '#/main/upload'}, ['button', {type: 'submit', class: 'pure-button pure-button-primary'}, 'Upload pictures']],
                  ['br'],
                  ['br'],
                  Views.query (x),
                  Views.manage (x),
               ]]
            ]],
            ['div', {class: 'pure-u-1-24'}],
            ['div', {class: 'pure-u-18-24'}, [
               Views.pics (x, ['Data', 'pics'])
            ]]
         ]]
      ];
   }

   // *** UPLOAD VIEW ***

   Views.upload = function (x) {return [
      ['style', [
         ['table.smallprint', {'font-size': 0.7}],
         ['div.progress-out', {
            border: 'solid 2px #eeeeee',
            'border-radius': 3,
            width: 0.5,
         }],
         ['div.progress-in', {
            'border-radius': 3,
            'background-color': '#4CAF50',
            padding: 5
         }, ['p', {
            color: 'white',
            margin: 0,
            'margin-left': 0.45
         }]]
      ]],
      ['a', {class: 'logout', onclick: 'c.cookie (false)', href: 'auth/logout'}, 'Logout'],
      ['br'], ['br'], ['br'],
      ['a', {class: 'buttonlink', href: '#/main/browse'}, ['button', {type: 'submit', class: 'pure-button pure-button-primary'}, 'Back to main view']],
      B.view (x, ['State', 'upload'], {listen: [
         ['upload', 'pics', function (x) {

            var pics = c ('form input') [0]

            if (pics.files.length === 0) return B.do (x, 'notify', 'yellow', 'Please select one or more pics.');

            dale.do (pics.files, function (file, k) {
               if (ALLOWEDMIME.indexOf (file.type) !== -1) {
                  B.do (x, 'add', ['State', 'upload', 'queue'], file);
               }
               else B.do (x, 'set', ['State', 'upload', 'invalid', file.name], true);
            });
            dale.do (c ('form input'), function (input) {
               input.value = '';
            });
         }],
         ['retry', 'upload', function (x) {
            var files = B.get ('State', 'upload', 'error');
            B.do (x, 'set', ['State', 'upload', 'error'], []);
            dale.do (files, function (file) {
               file.uploading = false;
               B.do (x, 'add', ['State', 'upload', 'queue'], file);
            });
         }],
      ]}, function (x, upload) {return [
         ['form', {onsubmit: 'event.preventDefault ()', class: 'pure-form pure-form-aligned'}, [
            ['br'], ['br'],
            ['fieldset', [
               B.view (['State', 'uploadFolder'], function (x, uploadFolder) {
                  if (uploadFolder) return [
                     ['h3', ['Upload a folder (or ', ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'uploadFolder'], false]), 'individual pictures'], ')']],
                     ['input', {type: 'file', name: 'pics', directory: true, webkitdirectory: true, mozdirectory: true}]
                  ];
                  else return [
                     ['h3', ['Upload one or more pictures (or ', ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'uploadFolder'], true]), ' an entire folder'], ')']],
                     ['input', {type: 'file', name: 'pics', multiple: true}],
                  ];
               }),
               ['button', B.ev ({type: 'submit', class: 'pure-button pure-button-primary'}, ['onclick', 'upload', 'pics']), 'Upload']
            ]]
         ]],
         ! upload ? [] : (function () {
            upload.queue = upload.queue || [];
            upload.done  = upload.done  || [];
            upload.error = upload.error || [];
            var perc = Math.round (upload.done.length / (upload.queue.length + upload.done.length) * 100);
            if (perc === 0) perc = 5;
            perc += '%';
            return ['div', {class: 'pure-g'}, [
               ['div', {class: 'pure-u-5-5'}, [
                  ['br'], ['br'],
                  upload.queue.length === 0 && upload.done.length > 0 ? ['h4', ['Uploaded ', upload.done.length, ' pictures']] : [],
                  upload.queue.length > 0 ? ['h4', ['Uploading ', upload.queue.length, ' pictures']] : [],
                  upload.queue.length > 0 || upload.done.length > 0 ? ['div', {class: 'progress-out'}, ['div', {class: 'progress-in', style: 'width: ' + perc}, ['p', perc]]] : [],
                  upload.queue.length > 0 ? ['h4', ['While you wait, you can', ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'subview'], 'browse']), ' start tagging your pictures!']]] : [],
               ]],
               upload.error.length === 0 ? [] : ['div', {class: 'pure-u-5-5'}, [
                  ['p', ['There was an error uploading ' + upload.error.length + ' pictures. ', ['span', B.ev ({class: 'action'}, ['onclick', 'retry', 'upload']), 'Retry']]],
                  ['table', {class: 'pure-table smallprint'}, [
                     ['thead', ['tr', ['th', 'Pictures that could not be uploaded']]],
                     dale.do (upload.error, function (file) {
                        return ['tr', ['td', file.name]];
                     })
                  ]]
               ]],
               upload.done.length === 0 ? [] : ['div', {class: 'pure-u-5-5'}, [
                  ['p', ['The following ' + upload.done.length + ' pictures were uploaded successfully:']],
                  Views.pics (x, ['State', 'upload', 'done']),
               ]],
               dale.keys (upload.repeated).length === 0 ? [] : ['div', {class: 'pure-u-5-5'}, [
                  ['p', [
                     'The following ' + dale.keys (upload.repeated).length + ' pictures were already uploaded to your account, so they were ignored. ',
                     ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'upload', 'repeated'], {}]), 'Dismiss.']
                  ]],
                  ['table', {class: 'pure-table smallprint'}, [
                     ['thead', ['tr', ['th', 'Repeated pictures']]],
                     dale.do (upload.repeated, function (v, name) {
                        return ['tr', ['td', name]];
                     })
                  ]]
               ]]
            ]];
         }) ()
      ]}),
      B.view (x, ['State', 'upload', 'invalid'], function (x, invalid) {
         if (! invalid || dale.keys (invalid).length === 0) return;
         return [
            ['p', [
               'The following files are invalid images and will be ignored. ',
               ['span', B.ev ({class: 'action'}, ['onclick', 'set', ['State', 'upload', 'invalid'], {}]), 'Dismiss.']
            ]],
            ['table', {class: 'pure-table smallprint'}, [
               ['thead', ['tr', ['th', 'Invalid pictures']]],
               dale.do (invalid, function (v, name) {
                  return ['tr', ['td', name]];
               })
            ]]
         ];
      })
   ]}

   // *** PICS VIEW ***

   Views.pics = function (x, path) {return [
      ['style', [
         ['div.selected', {
            'background-color': 'blue'
         }],
         ['img.pure-img', {
            cursor: 'pointer',
            'background-color': '#ddd',
            'border-radius': 8,
            /*
            'vertical-align': 'top',
            margin: 'auto',
            display: 'block',
            float: 'none !important'
            */
            'max-height, max-width': 0.95,
            'width, height, margin': 'auto',
            position: 'absolute',
            'top, bottom, left, right': 3
         }],
         ['img.selected', {
            'box-shadow': 'inset 0 0 0 1000px rgba(255,0,0,0.5)',
            opacity: '0.5'
         }],
         ['div.imgcont', {
            position: 'relative',
            display: 'inline-block',
            'width, height': 210,
            height: 130,
            'vertical-align': 'middle',
            'text-align': 'middle',
            'border-radius': 4,
            'background-color': '#222222',
            'margin-right, margin-bottom': 3
         }],
         ['div.imgtext', {
            opacity: 0,
            width: 0.97,
            height: 25,
            padding: 5,
            background: 'rgba(0,0,0,.8)',
            color: 'white',
            position: 'absolute',
            'bottom, left': 3,
            'vertical-align': 'bottom',
            'font-size': 0.7,
            transition: 'opacity',
         }],
         ['div.left', {float: 'left'}],
         ['div.right', {float: 'right'}],
         ['div.imgcont:hover div.imgtext', {
            'transition-delay': '0.4s',
            opacity: '1',
            '-webkit-box-sizing, -moz-box-sizing, box-sizing': 'border-box'
         }],
         ['section.piclist', {
            //background: 'rgba(25,25,25,0.2)',
            //'border-radius': 8,
            //padding: 8
         }],
      ]],
      B.view (x, path, {listen: [
         ['click', 'pic', function (x, pic, k) {
            var last = B.get ('State', 'lastclick') || {time: 0};
            if (last.id === pic.id && Date.now () - B.get ('State', 'lastclick').time < 200) {
               B.do (x, 'set', ['Data', 'pics', k, 'selected'], false);
               return B.do (x, 'set', ['State', 'canvas'], pic);
            }
            var lastIndex = dale.stopNot (B.get ('Data', 'pics'), undefined, function (pic, k) {
               if (pic.id === last.id) return k;
            });
            if (! B.get ('State', 'shift') || B.get ('State', 'ctrl') || last.id === pic.id || ! B.get ('Data', 'pics', lastIndex, 'selected')) {
               B.do (x, 'set', ['State', 'lastclick'], {id: pic.id, time: Date.now ()});
               return B.do (x, 'set', ['Data', 'pics', k, 'selected'], ! pic.selected);
            }
            dale.do (dale.times (Math.max (lastIndex, k) - Math.min (lastIndex, k) + 1, Math.min (lastIndex, k)), function (k) {
               B.set (['Data', 'pics', k, 'selected'], true);
            });
            B.do (x, 'change', ['Data', 'pics']);
            B.do (x, 'set', ['State', 'lastclick'], {id: pic.id, time: Date.now ()});
         }],
      ], ondraw: function (x) {
         document.onscroll = function (e) {
            var prev = B.get ('State', 'lastscroll');
            if (prev && (Date.now () - prev.date < 100)) return;
            B.do ({from: {ev: 'scroll'}}, 'set', ['State', 'lastscroll'], {date: Date.now (), y: window.scrollY});
            if (prev && prev.y > window.scrollY) return;

            lasty = window.innerHeight;
            lasti = c ('img') [B.get ('Data', 'pics').length - 1].getBoundingClientRect ().top;

            if (lasty < lasti) return;
            B.do ({from: {ev: 'scroll'}}, 'retrieve', 'pics');
         }
      }}, function (x, pics) {
         if (! pics || pics.length === 0) return;
         return ['section', {class: 'piclist'}, dale.do (pics, function (pic, k) {
            var date = new Date (parseInt (pic.date));
            date = date.getDate () + '/' + (date.getMonth () + 1) + '/' + date.getFullYear ();
            return ['div', {class: 'imgcont'}, [
               ['img', B.ev ({class: 'pure-img' + (pic.selected ? ' selected' : ''), style: 'padding: 2px; float: left', src: H.picPath (pic)}, ['onclick', 'click', 'pic', pic, k])],
               ['div', {class: 'imgtext'}, [
                  ['div', {class: 'left'}, [['i', {class: 'ion-pricetag'}], ' ' + (pic.tags ? teishi.p (pic.tags).length : 0)]],
                  ['div', {class: 'right'}, ['span', date]]
               ]],
               (k + 1) % 3 === 0 ? ['p', {style: 'clear: both; margin: 0px;'}] : []
            ]];
         })];
      })
   ]}

   // *** CANVAS VIEW ***

   Views.canvas = function (x) {
      return B.view (x, ['State', 'canvas'], {listen: [
         ['canvas', '*', function (x) {
            var action = x.path [0];
            if (action !== 'prev' && action !== 'next') return;
            var pics = B.get ('Data', 'pics');
            if (! pics) return;
            var index = dale.stopNot (pics, undefined, function (pic, k) {
               if (pic.id === B.get ('State', 'canvas', 'id')) return k;
            });
            if (action === 'prev' && index === 0) return B.do (x, 'set', ['State', 'canvas'], pics [pics.length - 1]);
            if (action === 'next' && index >= pics.length - 5) {
               B.do (x, 'retrieve', 'pics');
               /*
               var length = pics.length;
               setTimeout (function () {
                  if (length !== B.get ('Data', 'pics').length) B.do (x, 'set', ['State', 'canvas'], B.get ('Data', 'pics', index + 1));
               }, 300);
               return;
               */
            }
            B.do (x, 'set', ['State', 'canvas'], B.get ('Data', 'pics', index + (action === 'prev' ? -1 : 1)));
         }]
      ], ondraw: function (x) {
         if (B.get ('State', 'canvas')) H.fullScreen ();
         else                           H.fullScreen (true);
      }}, function (x, canvas) {
         if (! canvas) return;
         return [
            ['style', [
               canvas ? ['body', {overflow: 'hidden'}] : [],
               ['div.canvas', {
                  position: 'fixed',
                  'top, left': 0,
                  'height, width, min-height, min-width, max-height, max-width': 1,
                  'background': 'rgba(50,50,50,0.9)',
                  'z-index': '1',
               }, [
                  ['div.inner1', {
                     'width, min-width, max-width': 0.92,
                     'height, min-height, max-height': 0.86,
                     'margin-left': 0.04,
                     'margin-top': 0.02,
                     'padding-top': 0.02,
                     'background-color': 'black'
                  }],
                  ['div.inner2', {
                     'width, min-width, max-width': 0.98,
                     'height, min-height, max-height': 0.98,
                     'margin-left': 0.01,
                     'background-position': 'center !important',
                     'background-size': 'contain !important',
                     'background-repeat': 'no-repeat !important'
                  }],
                  ['div.inner3', {
                     //'width, min-width, max-width': 0.98,
                     //'height, min-height, max-height': 0.98,
                     //'margin-left, margin-top': 0.02,
                     //'background-position': 'center !important',
                     //'background-repeat': 'no-repeat !important',
                     '-webkit-background-size, -moz-background-size, -o-background-size, background-size': 'cover !important',
                  }],
                  ['div.info', {
                     'padding-top': 5,
                     height: 0.08,
                     'text-align': 'center',
                     color: 'white',
                     'background-color': '#444444',
                  }, ['ul', {
                     margin: 'auto',
                     width: 0.5
                  }]],
                  ['img', {
                     'max-width, max-height': 0.9,
                     'z-index': '2',
                  }],
                  ['.icon', {
                     'font-size': '1.8em',
                     color: 'white',
                  }],
                  ['.ion-close', {
                     right: 15,
                     top: 10,
                  }],
                  ['.ion-chevron-left', {
                     left: 10,
                     top: 0.5 * window.innerHeight,
                     //'font-size': '2.3em'
                     'font-size': '40px',
                  }],
                  ['.ion-chevron-right', {
                     right: 15,
                     top: 0.5 * window.innerHeight,
                     'font-size': '40px',
                  }],
                  ['.ion-information-circled', {
                     'font-size': '40px',
                  }],
               ]]
            ]],
            ['div', {class: 'canvas'}, [
               //['div', {class: 'inner1'}, ['div', {class: 'inner2', style: 'background: url(' + H.picPath (canvas, 900) + ')'}]],
               (function () {
                  //   'background-size': '95% 95% !important',//'contain !important',
                  var leftm = 40, topm = 0;
                  var screenw = window.innerWidth - leftm * 2, screenh = window.innerHeight - topm * 2, picw = parseInt (canvas.dimw), pich = parseInt (canvas.dimh);
                  if (Math.max (picw, pich, 900) === 900) var thuw = picw, thuh = pich;
                  else var thuw = picw * 900 / Math.max (picw, pich), thuh = pich * 900 / Math.max (picw, pich);

                  var wratio = screenw / thuw, hratio = screenh / thuh;
                  // Respect aspect ratio; at most duplicate picture.
                  var ratio = Math.min (wratio, hratio, 2);
                  var style = 'width: ' + (ratio * thuw) + 'px; height: ' + (ratio * thuh) + 'px; ';
                  var left = (screenw - (ratio * thuw)) / 2, top = (screenh - (ratio * thuh)) / 2;
                  style += 'margin-left: ' + (left + leftm) + 'px; margin-top: ' + (top + topm) + 'px; ';
                  //return ['div', {class: 'inner3', style: style + 'background: url(' + H.picPath (canvas, 900) + ') no-repeat center center fixed'}];
                  return [
                     ['div', {class: 'inner3', style: style + 'background: url(' + H.picPath (canvas, 900) + ')'}],
                     ['i', B.ev ({class: 'icon ion-information-circled', style: 'bottom: ' + (10 + topm / 2 + (screenh - (ratio * thuh)) / 2) + 'px; left: ' + (25 + leftm / 2 + (screenw - (ratio * thuw)) / 2) + 'px;'},  ['onclick', 'set', ['State', 'showPictureInfo'], true])],
                  ];
               }) (),
               B.view (['State', 'showPictureInfo'], function (x, show) {
                  if (! show) return;
                  return ['div', {class: 'info pure-u-24-24'}, [
                     ['ul', {class: 'search'}, [
                        (function () {
                           var date = new Date (parseInt (canvas.date));
                           date = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'} [date.getDay ()] + ' ' + date.getDate () + ' ' + {1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'} [(date.getMonth () + 1)] + ' ' + date.getFullYear ();
                           return ['li', {style: 'border: 0; font-weight: bold;'}, date];
                        }) (),
                        dale.do (teishi.p (canvas.tags) || [], function (tag) {
                           return ['li', tag];
                        }),
                        ['p', canvas.name]
                     ]]
                  ]];
               }),
               ['i', B.ev ({class: 'icon ion-close'}, ['onclick', 'set', ['State', 'canvas'], undefined])],
               ['i', B.ev ({class: 'icon ion-chevron-left'},  ['onclick', 'canvas', 'prev'])],
               ['i', B.ev ({class: 'icon ion-chevron-right'}, ['onclick', 'canvas', 'next'])],
            ]]
         ];
      });
   }

}) ();