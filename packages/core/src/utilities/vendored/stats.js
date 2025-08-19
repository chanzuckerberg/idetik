/**
 * @author mrdoob / http://mrdoob.com/
 *
 * Modified to add resizing support via the `scale` parameter.
 */

var Stats = function(scale = 1) {

  var mode = 0;

  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000';
  container.addEventListener('click', function(event) {

    event.preventDefault();
    showPanel(++mode % container.children.length);

  }, false);

  //

  function addPanel(panel) {

    container.appendChild(panel.dom);
    return panel;

  }

  function showPanel(id) {

    for (var i = 0; i < container.children.length; i++) {

      container.children[i].style.display = i === id ? 'block' : 'none';

    }

    mode = id;

  }

  //

  var beginTime = (performance || Date).now(), prevTime = beginTime, frames = 0;

  var fpsPanel = addPanel(new Stats.Panel('FPS', '#0ff', '#002', scale));
  var msPanel = addPanel(new Stats.Panel('MS', '#0f0', '#020', scale));

  if (self.performance && self.performance.memory) {

    var memPanel = addPanel(new Stats.Panel('MB', '#f08', '#201', scale));

  }

  showPanel(0);

  return {

    REVISION: 16,

    dom: container,

    addPanel: addPanel,
    showPanel: showPanel,

    begin: function() {

      beginTime = (performance || Date).now();

    },

    end: function() {

      frames++;

      var time = (performance || Date).now();

      msPanel.update(time - beginTime, 200);

      if (time >= prevTime + 1000) {

        fpsPanel.update((frames * 1000) / (time - prevTime), 100);

        prevTime = time;
        frames = 0;

        if (memPanel) {

          var memory = performance.memory;
          memPanel.update(memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576);

        }

      }

      return time;

    },

    update: function() {

      beginTime = this.end();

    },

    // Backwards Compatibility

    domElement: container,
    setMode: showPanel

  };

};

Stats.Panel = function(name, fg, bg, scale) {

  var min = Infinity, max = 0, round = Math.round;
  var PR = round(window.devicePixelRatio || 1);

  var WIDTH = round(80 * PR * scale);
  var HEIGHT = round(48 * PR * scale);
  var TEXT_X = round(3 * PR * scale);
  var TEXT_Y = round(2 * PR * scale);
  var GRAPH_X = round(3 * PR * scale);
  var GRAPH_Y = round(15 * PR * scale);
  var GRAPH_WIDTH = round(74 * PR * scale);
  var GRAPH_HEIGHT = round(30 * PR * scale);

  var canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.cssText = `width:${round(scale * 80)}px;height:${round(scale * 48)}px`;

  var context = canvas.getContext('2d');
  context.font = 'bold ' + round(9 * PR * scale) + 'px Helvetica,Arial,sans-serif';
  context.textBaseline = 'top';

  context.fillStyle = bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = fg;
  context.fillText(name, TEXT_X, TEXT_Y);
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  context.fillStyle = bg;
  context.globalAlpha = 0.9;
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  return {

    dom: canvas,

    update: function(value, maxValue) {

      min = Math.min(min, value);
      max = Math.max(max, value);

      context.fillStyle = bg;
      context.globalAlpha = 1;
      context.fillRect(0, 0, WIDTH, GRAPH_Y);
      context.fillStyle = fg;
      context.fillText(round(value) + ' ' + name + ' (' + round(min) + '-' + round(max) + ')', TEXT_X, TEXT_Y);

      context.drawImage(canvas, GRAPH_X + PR, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT, GRAPH_X, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT);

      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

      context.fillStyle = bg;
      context.globalAlpha = 0.9;
      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, round((1 - (value / maxValue)) * GRAPH_HEIGHT));

    }

  };

};

export { Stats as default };
