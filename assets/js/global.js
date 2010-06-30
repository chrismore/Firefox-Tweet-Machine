var bubbleWrapper;

var stage = [ window.screenX, window.screenY, window.innerWidth, window.innerHeight ];
getBrowserDimensions();

/* var worldAABB, world, iterations = 1, timeStep = 1 / 20; */
var worldAABB, world, iterations = 1, timeStep = 1 / 100;

var walls = [];
var wall_thickness = 200; // Seems to have no effect
var wallsSetted = false;
var bodies, elements, text;
var PI2 = Math.PI * 2;

$(document).ready(function(){
  init();
  play();
  
  getDataFromProxy();
  setInterval(spawn, 3000);
  
});

var debug = false;

var data_update_count = 0;
var max_bubbles_on_screen = 9;
var loop_interval;

var pool = [];
var pool_index = 0;
var pool_count_spawned = 0;

var timeline_data;
var timeline_data_max_id = 0;
var sb_timeline_step = 0;

var search_data;
var search_data_max_id = 0;

// BASE SPEED OF BOUNCING. WILL ADD RAINDOM 0-100 TO UNSYNC BOUNCING
var wobble_speed = 1000;
var wobble_distance = 20;

// Special bubbles
var sb_clock_step = 0; // Minutes
var sb_clock_last = 0;

var sb_ffdownloads_step = 0; // At each step of downloads
var sb_ffdownloads_last = 0;
var sb_ffdownloads_total = 0;

var sb_followers_step = 0;
var sb_followers_last = 0;
var sb_followers_total = 0;

var ds_type;
var ds_datetime;
var ds_datetime_description;

var ds_followers;
var ds_followers_description;

function getDataFromProxy() {
  $.getJSON('/proxy.php', function(data) {
    // print it out to the wrapper
    if (data.status.http_code == 200) {
      
      if (debug) console.log('Received code 200');
      
      data_update_count ++;
      
      // Update variables with new data
      sb_clock_step = data.contents.special_bubbles.sb_clock_step;
      
      sb_ffdownloads_step = data.contents.special_bubbles.sb_ffdownloads_step;
      sb_ffdownloads_total = data.contents.special_bubbles.sb_ffdownloads_total;
      
      sb_followers_step = data.contents.special_bubbles.sb_followers_step;
      sb_followers_total = data.contents.timeline[0].user.followers_count;
      $('dd.twitter-follow a').text(addCommas(sb_followers_total));
      
      sb_timeline_step = data.contents.special_bubbles.sb_timeline_step;
      
      ds_type = data.contents.display.ds_type;
      ds_datetime = data.contents.display.ds_datetime;
      ds_datetime_description = data.contents.display.ds_datetime_description;
      ds_followers = data.contents.display.ds_followers;
      ds_followers_description = data.contents.display.ds_followers_description;

      // Reverse results, so we start with oldest
      timeline_data = data.contents.timeline;
      timeline_data.reverse();      
      search_data = data.contents.search_results;
      search_data.results.reverse();
      
      if (debug) console.log(search_data.results.length + ' results for search');
      if (debug) console.log('Previous pool length: ' + pool.length);
      
    	for (var i = 0; i < search_data.results.length; i++) {
        var result = search_data.results[i];
        
        // See if this is newer than what is already pooled
        // If yes, add it at current position
        // If not, do nothing
        if (result.id > search_data_max_id) {
          pool.splice(pool_index, 0, {type: 'search', data: result});
          search_data_max_id = result.id;
        }
    	}
      if (debug) console.log('New pool length: ' + pool.length);
      
      // Run only the second and next times
      if (data_update_count >= 2) {
        specialBubbleFFDownloadsCheck();
      }
      
      // Run only the third and next times
      if (data_update_count >= 3) {
        specialBubbleFollowersCheck();
      }
      
    } else {
      contents = data.status.http_code;
    }
    
    spawn();
    setTimeout(getDataFromProxy, 1000 * 60);
  });

}

function spawn() {
  
  // Check if pool is empty
  if (pool.length == 0) return;
  
  // Check if there are too many bubbles on display
  if (bodies.length >= max_bubbles_on_screen) return;
  
  // Check if at end of pool
  // If so, resort it by id and delete whatever is over 40 results
  if ((pool_index+1) > pool.length) {
    pool_index = 0;
  }
  
  // Create the bubble 
  createBubble(pool[pool_index].type, pool[pool_index].data);
  pool_count_spawned ++;
  
  // Jump to next
  pool_index ++;
  
  // Check if I should show timeline tweets
  specialBubbleTimelineCheck();
  
}

function search() {
  // Clear the pool
  clearPool();
}

function clearPool () {
  pool = [];
  pool_index = 0;
}


function init() {

	bubbleWrapper = document.getElementById('bubbles');

	// create and configure new world
	worldAABB = new b2AABB();
	worldAABB.minVertex.Set( 0, 0 );
	worldAABB.maxVertex.Set( screen.width, screen.height + 200 );

  // x/y point of gravity - the further, the stronger
  var gravity = new b2Vec2( 0, -300 );
  
  // allow objects to sleep, 
  var doSleep = false;
	world = new b2World( worldAABB, gravity, doSleep );

  // set walls around the world
	setWalls();
	reset();
}


function createBubble(type, data) {

  // calculate the position, will be used to place the element once created
  // could be changed to a fixed spawn point that'd match the machine chimney
	var x = stage[2]/2;
	var y = stage[3]-200;

  // generate the random size
	// var size = (Math.random() * 50 >> 0) + 200;
	var size = 230;
  var bubbleClass;
  
  turnLampOn();
  
  // create the DOM element to be animated
	var element = document.createElement("article");
	element.width = size;
	element.height = size;
	element.style['position'] = 'absolute';
	element.style['left'] = -400 + 'px';
	element.style['top'] = -400 + 'px';
	
	
	switch (type) {
	
    case 'search':
  	
      element.className = 'bubble tweet';
      element.innerHTML = buildBubbleTweet(data);
      break;
      
    case 'clock':
  	
      element.className = 'bubble clock';
      element.innerHTML = buildBubbleClock(data);
      pool.splice(pool_index, 1);
      pool_index --;
      break;
    	 
  	case 'ffdownloads':
      
      element.className = 'bubble ffdownloads';
      //element.innerHTML = buildBubbleTweet(data);
      pool.splice(pool_index, 1);
      pool_index --;
      break;
  
  	case 'timeline':
      
      element.className = 'bubble tweet firefox';
      element.innerHTML = buildBubbleTweet(data);
      pool.splice(pool_index, 1);
      pool_index --;
      break;

	}
	
	
  $(element).hover(function() {
    $(this).find("nav").fadeIn();
  }, function() {
    $(this).find("nav").fadeOut();
  });
  
  wobbleTheBubble($(element));
  
  // append the element to the bubbleWrapper
	$(bubbleWrapper).append(element);

  // add that element to the elements array (needs to check this a bit more)
	elements.push( element );

  // create a new box2d body
	var b2body = new b2BodyDef();

  // define that body as a circle and its properties
	var circle = new b2CircleDef();
	circle.radius = size >> 1;
	circle.density = 1;
	circle.friction = 0.3;
  // Restitution is how elastic something is 0 being in elastic and 1 being totally elastic
  circle.restitution = 0.1;
	circle.preventRotation = true;
	b2body.AddShape(circle);
	// add the body to userData, so that all the elements can be addressed and manipulated later on, reset(); clears them all for eg.
	b2body.userData = {element: element};

  // define position where the body will be spawned
	b2body.position.Set( x, y );

	// define initial velocity on x, y axis
/* 	b2body.linearVelocity.Set( Math.random() * 400 - 200, Math.random() * 400 - 200 ); */
	b2body.linearVelocity.Set( Math.random() * 800 - 400, -10 );
	// add the box2d body to the real world and bodies array
	bodies.push( world.CreateBody(b2body) );
	
	setTimeout(turnLampOff, 1000);
}


function setWalls() {

	if (wallsSetted) {

		world.DestroyBody(walls[0]);
		world.DestroyBody(walls[1]);
		world.DestroyBody(walls[2]);

		walls[0] = null; 
		walls[1] = null; 
		walls[2] = null; 
	}

  // arguments: world, x, y, width, height, fixed
  // top box wall
	walls[0] = createPoly(world, stage[2] / 2, 0, [
	 [(stage[2] / 2)+100, 0],
	 [0, 20],
	 [- (stage[2] / 2) - 100, 0]
  ], true);
  
  // bottom machine base box
	walls[1] = createBox(world, stage[2] / 2, stage[3], stage[2], 70);
	
	// machine polygon
	/*
	walls[2] = createPoly(world, stage[2] / 2, (stage[3]-310), [
	 [0, 0],
	 [100, 20],
	[300, 200],
	 [-300, 200],
	 [-100, 20]
  ], true);
  */

	wallsSetted = true;

}


// Check to see if it's time to spawn a Clock bubble
function specialBubbleClockCheck() {
  if (sb_clock_step > 0) {
    var now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
    seconds = now.getSeconds();
    
    if ((seconds == 0) && 
      ((minutes % sb_clock_step) == 0) && 
      ((hours + ':' + minutes) != sb_clock_last)) {
      sb_clock_last = hours + ':' + minutes
      pool.splice(pool_index, 0, {type: 'clock', data: 'It is ' + sb_clock_last});
    }
  }
}

function specialBubbleFFDownloadsCheck() {
  if (sb_ffdownloads_step > 0) {
    if ((sb_ffdownloads_total > sb_ffdownloads_last) &&
      (Math.floor(sb_ffdownloads_total / sb_ffdownloads_step) > Math.floor(sb_ffdownloads_last / sb_ffdownloads_step))) {
      sb_ffdownloads_last = sb_ffdownloads_total;
      pool.splice(pool_index, 0, {type: 'ffdownloads', data: 'Firefox just downloaded for the ' + Math.floor(sb_ffdownloads_total / sb_ffdownloads_step) * sb_ffdownloads_step + 'th time'});
    }
  }
}

function specialBubbleFollowersCheck() {
  if (sb_followers_step > 0) {
    if ((sb_followers_total > sb_followers_last) &&
      (Math.floor(sb_followers_total / sb_followers_step) > Math.floor(sb_followers_last / sb_followers_step))) {
      sb_followers_last = sb_followers_total;
      pool.splice(pool_index, 0, {type: 'followers', data: '@firefox just got its ' + Math.floor(sb_followers_total / sb_followers_step) * sb_followers_step + 'th follower'});
    }
  }
}

function specialBubbleTimelineCheck() {
  if ((sb_timeline_step > 0) && (timeline_data.length > 0)) {
    if ((pool_count_spawned % sb_timeline_step) == 0) {
    
      var i = 0;
      var found = false;
      while ((i < timeline_data.length) && (!found)) {
        var result = timeline_data[i];
        if (result.id > timeline_data_max_id) {
          pool.splice(pool_index, 0, {type: 'timeline', data: result});
          timeline_data_max_id = result.id;
          found = true;
        }
        i++;
    	}
    	
    	// If none found, set max_id to 0 and start over
    	if (!found) {
      	timeline_data_max_id = 0;
        specialBubbleTimelineCheck();
      }
      
    }
  }
}




// run this on every frame
function loop(){
  
  // check for changes in the viewport and adjust the walls if there's any change
  if (getBrowserDimensions()) {
    setWalls();
  }
  
  specialBubbleClockCheck();
  
	// make the time advance
	world.Step(timeStep, iterations);

	for (i = 0; i < bodies.length; i++) {

		var body = bodies[i];
		var element = elements[i];
		
		newLeft = (body.m_position0.x - (element.width >> 1))
		newTop = (body.m_position0.y - (element.height >> 1))
		element.style.left = newLeft + 'px';
		element.style.top = newTop + 'px';


		// Destroy bubble if it's out of the screen
		if (((newLeft + Math.floor(element.width)) <= 1) ||
		  (newLeft > stage[2])){
		  world.DestroyBody(body);
		  bodies.splice(i, 1);
		  elements.splice(i, 1);
		  $(element).remove();
		}

	}

}


// .. BOX2D UTILS

function createBox(world, x, y, width, height, fixed) {

	if (typeof(fixed) == 'undefined') {
		fixed = true;
	}

	var boxSd = new b2BoxDef();
	if (!fixed) {
		boxSd.density = 1.0;
	}
	boxSd.extents.Set(width, height);
	var boxBd = new b2BodyDef();
	boxBd.AddShape(boxSd);
	boxBd.position.Set(x,y);
	return world.CreateBody(boxBd);
}

function createPoly(world, x, y, points, fixed) {
	var polySd = new b2PolyDef();
	if (!fixed) polySd.density = 1.0;
	polySd.vertexCount = points.length;
	for (var i = 0; i < points.length; i++) {
		polySd.vertices[i].Set(points[i][0], points[i][1]);
	}
	var polyBd = new b2BodyDef();
	polyBd.AddShape(polySd);
	polyBd.position.Set(x,y);
	return world.CreateBody(polyBd);
}

function play() {

	loop_interval = setInterval( loop, 1000 / 30 );
}

function reset() {

	var i;

	if ( bodies ) {

		for ( i = 0; i < bodies.length; i++ ) {

			var body = bodies[ i ]
      $(bubbleWrapper).children().remove();
			world.DestroyBody( body );
			body = null;
		}
	}
	
	bodies = [];
	elements = [];
	
}

// BROWSER DIMENSIONS

function getBrowserDimensions() {

	var changed = false;

	if (stage[0] != window.screenX) {

		stage[0] = window.screenX;
		changed = true;

	}

	if (stage[1] != window.screenY) {

		stage[1] = window.screenY;
		changed = true;

	}

	if (stage[2] != window.innerWidth) {

		stage[2] = window.innerWidth;
		changed = true;

	}

	if (stage[3] != window.innerHeight) {

		stage[3] = window.innerHeight;
		changed = true;

	}

	return changed;

}

function buildBubbleTweet(data) {
  
  //<p class="show">Adopt <span class="mood orange">Mozilla</span>! Get a limited <span class="mood green">edition</span> dino T-shirt when you <span class="mood violet">donate</span> to our Drumbeat Open <span class="mood pink">Web</span> Fund. <a href="#" title="" rel="external">mzl.la/bBM5YP</a></p>\
  /*
  html = '\
		<header>\
			<h1><a href="#" title="' + data.screen_name + '" rel="author external">' + data.screen_name + '</a> wrote</h1>\
			<time datetime="2009-10-09" pubdate><a href="#" rel="bookmark external" title="permalink">' + jQuery.timeago(data.created_at.substring(4)) + '</a></time>\
		</header>\
		<p class="avatar-wrapper"><a href="#" title="Firefox" rel="author external"><img alt="Firefox avatar" src="\
		' + data.profile_image_url + '" height="48" width="48" /></a></p>\
		<p>' + data.text + '</p>\
		<section class="hide">\
			<dl>\
				<dt>Name</dt>\
				<dd>' + data.screen_name + '</dd>\
				<dt>Location</dt>\
				<dd>' + data.location + '</dd>\
				<dt>Web</dt>\
				<dd><a href="#" rel="author external" title="Web">' + data.url + '</a></dd>\
				<dt>Followers</dt>\
				<dd>' + data.followers_count + '</dd>\
				<dt>Retweets</dt>\
				<dd>?</dd>\
				<dt>Bio</dt>\
				<dd>' + data.description + '</dd>\
			</dl>\
		</section>\
		<nav class="hide">\
			<ul>\
				<li class="flip"><a href="#section-id-01" title="Flip bubble">Flip</a></li>\
				<li class="retweet"><a href="#" title="Retweet" rel="external">Retweet</a></li>\
				<li class="follow"><a href="#" title="Follow" rel="external">Follow</a></li>\
			</ul>\
		</nav>\
	';
	*/
	
  html = '\
		<header>\
			<h1><a href="#" title="' + data.from_user + '" rel="author external">' + data.from_user + '</a> wrote</h1>\
			<time datetime="2009-10-09" pubdate><a href="#" rel="bookmark external" title="permalink">' + jQuery.timeago(data.created_at.substring(4)) + '</a></time>\
		</header>\
		<p class="avatar-wrapper"><a href="#" title="Firefox" rel="author external"><img alt="Firefox avatar" src="\
		' + data.profile_image_url + '" height="48" width="48" /></a></p>\
		<p>' + data.text + '</p>\
		<section class="hide">\
			<dl>\
				<dt>Name</dt>\
				<dd>' + data.from_user + '</dd>\
				<dt>Location</dt>\
				<dd>?</dd>\
				<dt>Web</dt>\
				<dd><a href="#" rel="author external" title="Web">?</a></dd>\
				<dt>Followers</dt>\
				<dd>?</dd>\
				<dt>Retweets</dt>\
				<dd>?</dd>\
				<dt>Bio</dt>\
				<dd>?</dd>\
			</dl>\
		</section>\
		<nav class="hide">\
			<ul>\
				<li class="flip"><a href="#section-id-01" title="Flip bubble">Flip</a></li>\
				<li class="retweet"><a href="#" title="Retweet" rel="external">Retweet</a></li>\
				<li class="follow"><a href="#" title="Follow" rel="external">Follow</a></li>\
			</ul>\
		</nav>\
	';
	
	return html;
}


function buildBubbleClock(data) {
  
  html = 'The time is: <strong>' + data + '</strong>';
	
	return html;
}





// BOUNCER. CALLBACK OF ANIMATION IS THE BOUNCER ITSELF, TO LOOP ALL NIGHT LONG
function wobbleTheBubble(bubbleToWobble) {
	newx = Math.floor(wobble_distance*Math.random());
	newy = Math.floor(wobble_distance*Math.random());
	new_random_speed = wobble_speed + Math.floor(100*Math.random());
	$(bubbleToWobble).animate(
		{ backgroundPosition: newx + 'px ' + newy + 'px' },
		new_random_speed,
		'linear',
		function() {
			wobbleTheBubble(bubbleToWobble);
		}
	);
}

function addCommas(nStr) {
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

function turnLampOn() {
  $('#activity-indicator').removeClass('off').addClass('on');
}
function turnLampOff() {
  $('#activity-indicator').removeClass('on').addClass('off');
}