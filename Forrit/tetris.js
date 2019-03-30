var canvas;
var gl;

/* ******** Nokkrar 'upphafstillingar' *******  */
var movement = false; // Mouse click drag
var spinX = 0;
var spinY = 0;
var origX;
var origY;

var boxSize = 6;

var zView = boxSize * 3; // viewer z position

var proLoc;
var mvLoc;
var colorLoc;

// Number of points for each object
var Numfill = points.boxFill.length;
var Numframe = points.boxFrame.length;

// The points in 3d space -- in vertices file
var vertices = points.boxFill.concat(points.boxFrame);

var keys = {};
var currBlock;
var nextBlock;
var updateTimer = true;
var dropTimer = true;
var isPaused = true;
var started = false;
var dropspeed = 1000;

var grid = Array.from(Array(20), _ => Array.from(Array(6), _ => Array(6).fill(0))); // [20[6[6]]] -- [y[z[x]]]


var colors = [
  vec4(0.8, 0.0, 0.0, 0.5),
  vec4(0.8, 0.0, 0.0, 0.5),
  vec4(0.0, 0.8, 0.0, 0.5),
  vec4(0.0, 0.0, 0.8, 0.5),
  vec4(0.8, 0.0, 0.8, 0.5),
  vec4(0.8, 0.8, 0.0, 0.5),
  vec4(0.0, 0.8, 0.8, 0.5)
];

window.onload = function init() {
  canvas = document.getElementById('gl-canvas');

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.2, 0.4, 1.0);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.enable(gl.CULL_FACE);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  //  Load shaders and initialize attribute buffers
  var program = initShaders(gl, 'vertex-shader', 'fragment-shader');
  gl.useProgram(program);

  var vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

  var vPosition = gl.getAttribLocation(program, 'vPosition');
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  colorLoc = gl.getUniformLocation(program, 'fColor');
  proLoc = gl.getUniformLocation(program, 'projection');
  mvLoc = gl.getUniformLocation(program, 'modelview');

  // Projection array for viewer
  var proj = perspective(90.0, 1.0, 0.1, 100.0);
  gl.uniformMatrix4fv(proLoc, false, flatten(proj));

  // Create first element
  nextBlock = newBlock();

  // Mouse handlers
  canvas.addEventListener('mousedown', function(e) {
    movement = true;
    origX = e.offsetX;
    origY = e.offsetY;
    //e.preventDefault(); // Disable drag and drop
  });

  canvas.addEventListener('touchstart', function(e) {
    movement = true;
    origX = e.clientX || e.targetTouches[0].pageX;
    origY = e.clientY || e.targetTouches[0].pageY;
    e.preventDefault(); // Disable drag and drop
  });

  canvas.addEventListener('mouseup', function(e) {
    movement = false;
  });
  canvas.addEventListener('touchend', function(e) {
    movement = false;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (movement) {
      spinY += (e.offsetX - origX) % 360;
      spinX += (e.offsetY - origY) % 360;
      origX = e.offsetX;
      origY = e.offsetY;
    }
  });
  canvas.addEventListener('touchmove', function(e) {
    if (movement) {
      var currx = e.clientX || e.targetTouches[0].pageX;
      var curry = e.clientY || e.targetTouches[0].pageY;
      spinY += (currx - origX) % 360;
      spinX += (curry - origY) % 360;
      origX = currx;
      origY = curry;
    }
  });

  // Keyboard functions
  window.addEventListener('keydown', function(e) {
    e = e || event;
    keys[e.keyCode] = e.type == 'keydown';
    if (keys[13] && !started) {
      startGame();
    } // Enter - start game
    if (keys[80]) {
      isPaused = !isPaused;
    } // p Key - toggle pause
    if (document.activeElement === canvas){
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function(e) {
    e = e || event;
    keys[e.keyCode] = e.type == 'keydown';
  });

  // Scroll wheel handler
  window.addEventListener('mousewheel', function(e) {
    if (document.activeElement === canvas){
      if (e.wheelDelta > 0.0) {
        zView += 0.2;
      } else {
        zView -= 0.2;
      }
      e.preventDefault();
    }
  });

  setInterval(function() { updateTimer = true; }, 100);
  setInterval(function() { dropTimer = true; }, dropspeed);

  render();
};

function objClone(src) {
  return JSON.parse(JSON.stringify(src));
}


function blockMovement(b) {
  if (keys[37]) { moveBlock(b, 'x', -1); }
  if (keys[38]) { moveBlock(b, 'z', -1); }
  if (keys[39]) { moveBlock(b, 'x', 1); }
  if (keys[40]) { moveBlock(b, 'z', 1); }
  
// blockRotation
  if (keys[65]) { rotateBlock(b, ['y','z']); }
  if (keys[90]) { rotateBlock(b, ['z','y']); }
  if (keys[83]) { rotateBlock(b, ['x','z']); }
  if (keys[88]) { rotateBlock(b, ['z','x']); }
  if (keys[68]) { rotateBlock(b, ['x','y']); }
  if (keys[67]) { rotateBlock(b, ['y','x']); }

  return b;
}












































/**
 * Hér fyrir neðan er virkni leiksins
 * hefja leik
 * restarta
 * initiliza næsta kubb
 * fall sem býr til næsta kubb
 * og öll hreyfing
 */

function startGame() {
  reset();
  started = true;
  isPaused = false;
  setOfNextBlock();
}

function reset() {
  isPaused=true;
  started=false;
  document.getElementById("currScore").innerHTML = 0;
  grid = Array.from(Array(20), _ => Array.from(Array(6), _ => Array(6).fill(0))); // [20[6[6]]] -- [y[z[x]]]
}

function setOfNextBlock() {
  currBlock = nextBlock;
  nextBlock = newBlock();
  return currBlock;
}

function dropDown(b) {
  if (keys[32]) { t = moveBlock(b, 'y', -1); }     // Space
  if (dropTimer) { 
    b = moveBlock(b, 'y', -1);
    dropTimer = false;
  }
  return b;
}

function newBlock() {
  var center, other, third;
  var randX = Math.floor(Math.random() * 2) + 2;
  var randZ = Math.floor(Math.random() * 2) + 2;
  var color = Math.floor(Math.random() * 3) + 1;
  if (Math.random() < 0.5) {
    center = {x: randX, y: 21, z: randZ};
    other = {x: randX, y: 22, z: randZ};
    third = {x: randX, y: 20, z: randZ};
  } else {
    center = {x: randX, y: 20, z: randZ};
    other = {x: randX, y: 21, z: randZ};
    third = {x: randX + 1, y: 20, z: randZ};
  }

  var Block = {center, other, third, color};

  if (Math.random() > 0.5) {
    rotateBlock(Block, ['x', 'y']);
  }
  if (Math.random() > 0.5) {
    rotateBlock(Block, ['z', 'y']);
  }
  if (Math.random() > 0.5) {
    rotateBlock(Block, ['x', 'z']);
  }

  return Block;
}

function moveBlock(b, axis, num) {
  b.center[axis] += num;
  b.other[axis] += num;
  b.third[axis] += num;
  return b;
}

function blockAllocationForRotation(C, B, extra) {
  if (C[extra[0]] !== B[extra[0]] || C[extra[1]] !== B[extra[1]]) {
    if (C[extra[0]] > B[extra[0]]) {
      B[extra[0]] += 1;
      B[extra[1]] += 1;
    } else if (C[extra[0]] < B[extra[0]]) {
      B[extra[0]] -= 1;
      B[extra[1]] -= 1;
    } else if (C[extra[1]] > B[extra[1]]) {
      B[extra[0]] -= 1;
      B[extra[1]] += 1;
    } else if (C[extra[1]] < B[extra[1]]) {
      B[extra[0]] += 1;
      B[extra[1]] -= 1;
    }
  }
}

function rotateBlock(b, extra) {
  blockAllocationForRotation(b.center, b.other, extra);
  blockAllocationForRotation(b.center, b.third, extra);
}

function sidesCollide(b) {
  if (  (b.center.x > 5 || b.center.x < 0 )||(b.center.z > 5 || b.center.z < 0) ||
        (b.other.x > 5 || b.other.x < 0) ||(b.other.z > 5 || b.other.z < 0) ||
        (b.third.x > 5 || b.third.x < 0) ||(b.third.z > 5 || b.third.z < 0) ) {
    return true;
  }
  if (b.center.y < 20 && b.other.y < 20 && b.third.y < 20) {
    if (grid[b.center.y][b.center.x][b.center.z] !== 0) { return true; }
    if (grid[b.other.y][b.other.x][b.other.z] !== 0) { return true;}
    if (grid[b.third.y][b.third.x][b.third.z] !== 0) { return true;}
  }
  return false;
}

function downCollide(b) {
    if (b.center.y < 0 || b.other.y < 0 || b.third.y < 0) { return true; }
    if (b.center.y < 20 && b.other.y < 20 && b.third.y < 20) {
        if (grid[b.center.y][b.center.x][b.center.z] !== 0) { return true; }
        if (grid[b.other.y][b.other.x][b.other.z] !== 0) { return true;}
        if (grid[b.third.y][b.third.x][b.third.z] !== 0) { return true;}
    }
    return false;
}

function updateBlock(curr) {
  var next = objClone(curr);

  if (updateTimer) {
    next = blockMovement(next);
    updateTimer = false;
  }
  if (sidesCollide(next)) {
    next = objClone(curr);
  }

  if (!isPaused) {
    next = dropDown(next);
  }

  /**
   * Þetta checkar hvort við erum búin að tapa leiknum.
   * Ef curr. breyturnar verða stærri en 19 þýðir það að við erum komin í 
   * toppinn á boxinu okkar
   */
  if (downCollide(next)) {
    if (curr.center.y > 19 || curr.other.y > 19 || curr.third.y > 19) {
      window.alert('Game over \n'+'Final score: '+ document.getElementById("currScore").innerHTML);
      reset();
    }
    else {
      grid[curr.center.y][curr.center.x][curr.center.z] = curr.color;
      grid[curr.other.y][curr.other.x][curr.other.z] = curr.color;
      grid[curr.third.y][curr.third.x][curr.third.z] = curr.color;
    }
      
    checkForFullPlane();
    next = setOfNextBlock();
  }
  return next;
}


function checkForFullPlane() {
  var completed = [];
  grid.forEach((plane, y) => {
    if (plane.every(_ => _.every(curr => curr !== 0))) {
      completed.push(y);
    }
  });

  if (completed.length > 0) {
    addScore(completed.length);
  }
}

function addScore(planes) {
  var currScore = parseInt(document.getElementById("currScore").innerHTML);
  document.getElementById("currScore").innerHTML = currScore+planes*36;
}

function drawFrame(mv, pos) {
  mv = mult(mv, translate(pos.x * 2 - 5, pos.y * 2 - 19, pos.z * 2 - 5));
  // white frame arond the block
  gl.uniform4fv(colorLoc, vec4(0.5, 0.5, 0.5, 1.0));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.LINE_STRIP, Numfill, Numframe);
}

function drawBox(mv, pos, color) {
  mv = mult(mv, translate(pos.x * 2 - 5, pos.y * 2 - 19, pos.z * 2 - 5));
  // Half transparent glass container, only draw inside
  gl.uniform4fv(colorLoc, color);
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.TRIANGLES, 0, Numfill);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var mv = lookAt(
    vec3(0.0, 0.0, zView),
    vec3(0.0, 0.0, 0.0),
    vec3(0.0, 1.0, 0.0)
  );
  mv = mult(mv, rotateX(spinX));
  mv = mult(mv, rotateY(spinY));
  gl.cullFace(gl.FRONT); // outside

  mv = mult(mv, scalem(boxSize / 10, boxSize / 10, boxSize / 10));

  // update the postitions
  if (!isPaused) {
    currBlock = updateBlock(currBlock);
  }

  if (started) {
    drawBox(mv, currBlock.center, colors[currBlock.color]);
    drawBox(mv, currBlock.other, colors[currBlock.color]);
    drawBox(mv, currBlock.third, colors[currBlock.color]);
  }

  grid.forEach((_, y) =>
    _.forEach((_, x) =>
      _.forEach((curr, z) => {
        if (curr !== 0) {
          drawBox(mv, {x, y, z}, colors[curr]);
        }
      })
    )
  );

  mv = mult(mv, scalem(10 / boxSize, 10 / boxSize, 10 / boxSize));
  // Scale for platform
  mv = mult(
    mv,
    scalem(boxSize * 0.6 + 0.1, boxSize * 2 + 0.1, boxSize * 0.6 + 0.1)
  );

  gl.cullFace(gl.FRONT); // Inside

  //  Draw the platform
  gl.uniform4fv(colorLoc, vec4(1.0, 1.0, 1.0, 1.0));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.LINE_STRIP, Numfill, Numframe);

  // Half transparent glass container, only draw inside
  gl.uniform4fv(colorLoc, vec4(0.1, 0.1, 0.1, 0.001));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.TRIANGLES, 0, Numfill);

  // Reverse
  // mv = mult(mv, scalem(1 / boxSize, 1 / boxSize, 1 / boxSize));

  requestAnimFrame(render);
}