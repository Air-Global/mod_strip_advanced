/*
 * Breach: [mod_strip_advanced] strip_c.js
 *
 * Based on : mod_strip - Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: [mod_strip] spolu
 * @author: [mod_strip_advanced] air-global
 * 
 * @log:
 * - 2014-07-18 air-global 2 lines of unopened tabs & prep for scrolling through tabs
 * - 2014-07-18 air-global rebrand to mod_strip_advanced
 * - 2014-07-08 spolu  Disable actions when not available #11
 * - 2014-06-16 spolu  Tabs filtering
 * - 2014-06-13 spolu  Remove favicon on navigation #2
 * - 2014-06-13 spolu  Loading progress dumpling
 * - 2014-06-11 spolu  Removed angularJS
 * - 2014-06-04 spolu  Forked from `mod_stack`
 * - 2014-05-21 spolu  New state format (tabs on core_state)
 * - 2013-08-15 spolu  Creation
 */
'use strict'

// ### strip_c
//
// ```
// @spec { strip_el }
// ```
var strip_c = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.strip_el = spec.strip_el || $('.strip');
  my.wrapper_el = my.strip_el.find('.wrapper');
  my.tabs_el = my.strip_el.find('.tabs');
  my.back_el = my.strip_el.find('.command.back');
  my.forward_el = my.strip_el.find('.command.forward');
  my.new_el = my.strip_el.find('.command.new');
  my.scroll_back_el = my.strip_el.find('.command.scroll_back');
  my.scroll_forward_el = my.strip_el.find('.command.scroll_forward');

  my.TAB_WIDTH = 170;
  my.TAB_HEIGHT = 23;
  my.TAB_MARGIN = 0;
  my.TAB_SCROLLOFFSET = 0;

  /* Dictionary of tabs div elements. */
  my.tabs_divs = {};
  my.active = null;

  my.color = color({});

  //
  // ### _public_
  //
  var select_tab;         /* select_tab(tab_id); */
  var close_tab;          /* close_tab(tab_id); */

  var cmd_back;           /* cmd_back(); */
  var cmd_forward;        /* cmd_forward(); */
  var cmd_new;            /* cmd_new(); */
  var cmd_update;         /* cmd_update(); */
  var cmd_scroll_back;     /* cmd_scroll_back(); */
  var cmd_scroll_forward;  /* cmd_scroll_forward(); */

  var init;               /* init(); */

  //
  // ### _private_
  //
  var create_tab;         /* create_tab(tab_id); */
  var update_tab;         /* update_tab(tab_id, data); */
  var position_tab;       /* update_tab(tab_id, idx); */
  var remove_tab;         /* update_tab(tab_id); */
  
  var update_scroll;      /* update_scroll(); */

  var mousewheel_handler; /* mousewheel_handler(evt); */
  var dblclick_handler;   /* dblclick_handler(evt); */
  var state_handler;      /* state_handler(state); */

  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### create_tab
  //
  // Creates a new tab div element with the specified id
  // ```
  // @tab_id {string} the id of the tab
  // ```
  create_tab = function(tab_id) {
    var tab = $('<div/>')
      .attr('id', tab_id)
      .addClass('tab')
      .mousedown(function(event) {
        switch(event.which) {
            case 1:
              select_tab(tab_id);
              break;
            case 2:
              close_tab(tab_id);
              break;
        }
      })
      .append($('<div/>')
        .addClass('back-loading'))
      .append($('<div/>')
        .addClass('loading'))
      .append($('<div/>')
        .addClass('favicon'))
      .append($('<div/>')
        .addClass('content')
        .append($('<div/>')
          .addClass('shadow'))
        .append($('<div/>')
          .addClass('title')))
      .append($('<div/>')
        .addClass('close')
        .mousedown(function() {
          close_tab(tab_id);
        })
        .append($('<div/>')
          .addClass('icon-iconfont-01')));
    return tab;
  };

  // ### update_tab
  //
  // Updates the tab with the specified id with the newly received state
  // ```
  // @tab_id {string} the tab id
  // @data   {object} tab data and state received
  // ```
  update_tab = function(tab_id, data) {
    var tab = my.tabs_divs[tab_id];
    tab.removeClass('active');

    /* Construct desc object. */
    var desc = {
      title: '',
      url: '',
      host: '',
      favicon: '',
      loading: false
    };
    if(data.type === 'new_tab') {
      desc.title = 'New Tab';
      desc.url = 'blank';
    }
    else {
      desc.title = data.title;
      desc.url = data.url || '';
      if(data.state) {
        /* TODO(spolu): Keep old title as long as possible? */
        if(data.state.loading && !desc.title) {
          desc.title = 'Loading...';
        }
        data.state.entries.forEach(function(n) {
          if(n.visible) {
            if(n.favicon) {
              desc.favicon = n.favicon;
            }
            if(n.url) {
              desc.host = n.url.host;
            }
          }
        });
        desc.loading = data.state.loading;
      }
    }

    /* Update title. */
    tab.find('.title').text(desc.title);

    /* Update active state. */
    if(my.active === tab_id) {
      tab.addClass('active');
      my.back_el.addClass('disabled');
      my.forward_el.addClass('disabled');
      if(data.state && data.state.can_go_back) {
        my.back_el.removeClass('disabled');
      }
      if(data.state && data.state.can_go_forward) {
        my.forward_el.removeClass('disabled');
      }
    }

    /* Update favicon. */
    var favicon_el = tab.find('.favicon');
    var favicon_sha = SHA1(desc.favicon || '');

    var update_favicon = function() {
      var content_el = tab.find('.content');
      if(desc.favicon && desc.favicon.length > 0) {
        favicon_el.css('display', 'block');
        content_el.addClass('with-favicon');
        favicon_el.css('background-image',
                        'url(' + desc.favicon + ')');
        if(tab.favicon_need_color) {
          var proxied_img_url = null;
          if(desc.favicon.substr(0,5) === 'data:') {
            proxied_img_url = desc.favicon;
          }
          else {
            proxied_img_url = '/proxy?url=' + encodeURIComponent(desc.favicon);
          }
          var img = new Image();
          img.src = proxied_img_url;
          img.onload = function() {
            tab.favicon_need_color = false;
            var rgb = my.color.get(img);
            tab.find('.loading').css({
              'background-color': 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
            });
          }
        }
      }
      else {
        favicon_el.css('display', 'none');
        content_el.removeClass('with-favicon');
        favicon_el.css('background-image',
                        'none');
        if(tab.favicon_need_color) {
          tab.find('.loading').css({
            'background-color': ''
          });
        }
      }
      tab.favicon_sha = favicon_sha;
      tab.favicon_host = desc.host;
    };

    if(tab.favicon_host !== desc.host) {
      tab.favicon_need_color = true;
      update_favicon();
    }
    if(desc.favicon && favicon_sha !== tab.favicon_sha) {
      update_favicon();
    }

    /* Update loading. */
    if(desc.loading && !tab.loading) {
      tab.find('.loading').css({
        'transition': '',
        'right': my.TAB_WIDTH + 'px'
      });
      var value = 10;
      var update = function() {
        tab.find('.loading').css({
          'transition': 'right 0.2s ease-out',
          'right': Math.floor(my.TAB_WIDTH - my.TAB_WIDTH * value / 100) + 'px'
        });
      }
      setTimeout(function() {
        if(tab.loading) {
          update();
        }
      }, 100);
      var itv = setInterval(function() {
        if(tab.loading) {
          var dumpling = Math.exp(- value / (my.TAB_WIDTH - value));
          value = Math.min(Math.floor(value + dumpling * Math.random() * 20), 100);
          update();
        }
        else {
          clearInterval(itv);
        }
      }, 500);
      tab.loading = true;
    }
    if(!desc.loading && tab.loading) {
      tab.find('.loading').css({
        'right': '0px'
      });
      tab.loading = false;
    }
  };

  // ### position_tab
  //
  // Positions the tab given its index in the `state.tabs_order` array
  // ```
  // @tab_id {string} the tab id
  // @idx    {number} position
  // ```
  position_tab = function(tab_id, idx) {
    var tab = my.tabs_divs[tab_id];
    var left = (idx/2 * my.TAB_WIDTH + my.TAB_MARGIN) + my.TAB_SCROLLOFFSET;
    //var left = (idx/2 * my.TAB_WIDTH + my.TAB_MARGIN);
    var top = my.TAB_HEIGHT;
    
    if (idx %2 != 0) {
		top = 0;
		left = (idx - 1)/2 * my.TAB_WIDTH + (my.TAB_MARGIN * 2) + my.TAB_WIDTH + my.TAB_SCROLLOFFSET;
		//left = (idx - 1)/2 * my.TAB_WIDTH + (my.TAB_MARGIN * 2) + my.TAB_WIDTH;
	}
	
	if (idx == 0) {
		tab.addClass('first_tab');
		top = 0;
	}
	else {
		tab.removeClass('first_tab');
	}	

    tab.css('left', left);
    tab.css('top', top);
    
    /* If this is the active tab, we make sure it is visible. */
    if(my.active === tab_id) {
      var tabs_width = Object.keys(my.tabs_divs).length * (my.TAB_WIDTH + my.TAB_MARGIN);
      var tabs_left = my.tabs_el.position().left;

      if((idx + 1) * (my.TAB_WIDTH + my.TAB_MARGIN) + tabs_left > my.wrapper_el.width()) {
        my.tabs_el.css({
          'left': (my.wrapper_el.width() - (idx + 1) * (my.TAB_WIDTH + my.TAB_MARGIN)) + 'px'
        });
      }
      else if(-tabs_left > idx * (my.TAB_WIDTH + my.TAB_MARGIN)) {
        my.tabs_el.css({
          'left': -(idx * (my.TAB_WIDTH + my.TAB_MARGIN)) + 'px'
        });
      }
    }
  };

  // ### remove_tab
  //
  // Removes a tab by id
  // ```
  // @tab_id {string} the tab id
  // ```
  remove_tab = function(tab_id) {
    var tab = my.tabs_divs[tab_id];
    delete my.tabs_divs[tab_id];
    tab.remove();
  };
  
  // ### update_scroll
  //
  // Enables or disables the scroll buttons and moves the tabs around accordingly
  //
  update_scroll = function() {
	//Scroll back button
	if (my.TAB_SCROLLOFFSET >= 0) {
		my.scroll_back_el.addClass('disabled');
	}
	else {
		my.scroll_back_el.removeClass('disabled');
	}
	var left = my.new_el.position().left + my.new_el[0].offsetWidth + my.scroll_back_el[0].offsetWidth;
	my.wrapper_el.css('left', left + "px");
	
	//Scroll forward button
	if (((Object.keys(my.tabs_divs).length + (Object.keys(my.tabs_divs).length % 2 ? 1 : 2))/2 * my.TAB_WIDTH) + my.TAB_SCROLLOFFSET > my.wrapper_el[0].offsetWidth) {
		my.scroll_forward_el.removeClass('disabled');
	} else {
		my.scroll_forward_el.addClass('disabled');
	}
  };
  
  var scroll = function(amount) {
	  my.TAB_SCROLLOFFSET += amount;
	  if (my.TAB_SCROLLOFFSET > 0) {
		  my.TAB_SCROLLOFFSET = 0;
	  } else {
		  var amountOfTabs = Object.keys(my.tabs_divs).length;
		  var widthOfTabs = (amountOfTabs % 2 ? (amountOfTabs+1)/2*my.TAB_WIDTH : (amountOfTabs+2)/2*my.TAB_WIDTH);
		  var maxOffset = -(widthOfTabs - my.wrapper_el[0].offsetWidth);
		  if (my.TAB_SCROLLOFFSET < maxOffset) {
			  my.TAB_SCROLLOFFSET = maxOffset;
		  }
      }
      //my.tabs_el.css('padding-left', my.TAB_SCROLLOFFSET + "px");
      //Put something here that updates the tabs
      
      //And update the scroll
      update_scroll();
  };

  /**************************************************************************/
  /* JQUERY EVENTS HANDLER */
  /**************************************************************************/
  // ### mousewheel_handler
  //
  // Handles the mousewheel events to scroll tabs
  // ```
  // @evt {object} the jquery event
  // ```
  mousewheel_handler = function(evt) {
    var tabs_width = Object.keys(my.tabs_divs).length * (my.TAB_WIDTH + my.TAB_MARGIN);
    var tabs_left = my.tabs_el.position().left;

    var update = tabs_left + evt.originalEvent.wheelDeltaX;
    if(my.wrapper_el.width() - update > tabs_width) {
      update = my.wrapper_el.width() - tabs_width;
    }
    if(update > 0) {
      update = 0;
    }
    my.tabs_el.css({
      'transition': 'none',
      'left': (update) + 'px'
    });
  };
  // ### dblclick_handler
  //
  // Handles the dblclick events to add a new tab
  // ```
  // @evt {object} the jquery event
  // ```
  dblclick_handler = function(evt) {
    var el = evt.target;
    for (;el && el !== document.body; el = el.parentNode) if (el.classList.contains('tabs')) return;
    cmd_new();
  };

  /**************************************************************************/
  /* SOCKET.IO HANDLER */
  /**************************************************************************/
  // ### state_handler
  //
  // Socket.io `state` event handler
  // ```
  // @state {object} the tabs state
  // ```
  state_handler = function(state) {
    if(state) {
      var tabs_data = {};
      var tabs_order = [];
      /* Create any missing tab. */
      state.tabs.forEach(function(t) {
        tabs_data[t.tab_id] = t;
        tabs_order.push(t.tab_id);
        if(!my.tabs_divs[t.tab_id]) {
          my.tabs_divs[t.tab_id] = create_tab(t.tab_id);
          my.strip_el.find('.tabs').append(my.tabs_divs[t.tab_id]);
        }
      });
      /* Cleanup Closed tabs */
      Object.keys(my.tabs_divs).forEach(function(tab_id) {
        if(!tabs_data[tab_id]) {
          remove_tab(tab_id);
        }
      });

      my.active = tabs_order[state.active] || null;

      /* Update tabs position. */
      tabs_order.forEach(position_tab);

      /* Update tabs state. */
      tabs_order.forEach(function(tab_id) {
        update_tab(tab_id, tabs_data[tab_id]);
      });
      
      /* Update scroll state */
      tabs_order.forEach(update_scroll);

      /* Update update state. */
      if(state.breach_update) {
        my.strip_el.addClass('breach_update');
      }
      else {
        my.strip_el.removeClass('breach_update');
      }
      if(state.module_update) {
        my.strip_el.addClass('module_update');
      }
      else {
        my.strip_el.removeClass('module_update');
      }
    }
  };

  /**************************************************************************/
  /* PUBLIC METHODS */
  /**************************************************************************/
  // ### select_tab
  //
  // Selects the given tab by `tab_id`
  // ```
  // @tab_id {string} the tab id
  // ```
  select_tab = function(tab_id) {
    if(tab_id !== my.active) {
      my.socket.emit('select', tab_id);
    }
  };

  // ### close_tab
  //
  // Closes tabs by `tab_id`
  // ```
  // @tab_id {string} the tab id
  // ```
  close_tab = function(tab_id) {
    my.socket.emit('close', tab_id);
  };

  // ### cmd_back
  //
  // Issue a back command
  cmd_back = function() {
    my.socket.emit('back');
  };

  // ### cmd_forward
  //
  // Issue a forward command
  cmd_forward = function() {
    my.socket.emit('forward');
  };

  // ### cmd_new
  //
  // Issue a new tab command
  cmd_new = function() {
    my.socket.emit('new');
  };

  // ### cmd_update
  //
  // Open the module manager
  cmd_update = function() {
    my.socket.emit('update');
  };
  
  // ### cmd_scroll_back
  //
  // Scroll the tabs back
  cmd_scroll_back = function() {
	  scroll(100);
  };
  
  // ### cmd_scroll_forward
  //
  // Scroll the tabs forward
  cmd_scroll_forward = function() {
	  scroll(-100);
  };
  
  // ### init
  //
  // Initialises the controller
  init = function() {
    my.wrapper_el.bind('mousewheel', mousewheel_handler);
    my.wrapper_el.bind('dblclick', dblclick_handler);
    my.socket = io();
    my.socket.on('connect', function() {
      my.socket.on('state', state_handler);
      my.socket.on('scroll', scroll);
      my.socket.emit('handshake', '_strip');
    });

    return that;
  };


  that.select_tab = select_tab;
  that.close_tab = close_tab;

  that.cmd_back = cmd_back;
  that.cmd_forward = cmd_forward;
  that.cmd_new = cmd_new;
  that.cmd_update = cmd_update;
  that.cmd_scroll_back = cmd_scroll_back;
  that.cmd_scroll_forward = cmd_scroll_forward;

  that.init = init;

  return that;
};

