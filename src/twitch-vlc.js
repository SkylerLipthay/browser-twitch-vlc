setInterval(checkForFlashPlayers, 250);

function checkForFlashPlayers() {
  $('object[data*="TwitchPlayer.swf"]').each(function(index, player) {
    var $player = $(player);
    var param = $player.find('param[name="flashvars"]');
    if (!param) {
      return;
    }

    var value = param.attr('value') || '';
    var matches = value.match(/(^|&)channel=(\w+)/) || [];
    var channel = matches[2];

    if (!channel) {
      return;
    }

    replacePlayer($player, channel);
  });
}

function replacePlayer($player, channel) {
  var url = 'https://api.twitch.tv/api/channels/' + channel + '/access_token';

  $.get(url, function(data) {
    replacePlayerWithHlsData($player, channel, data);
  });
}

function replacePlayerWithHlsData($player, channel, token) {
  var url = 'http://usher.twitch.tv/api/channel/hls/' + channel + '.m3u8';
  var params = {
    player: 'twitchweb',
    p: Math.floor(Math.random() * 999999),
    type: 'any',
    allow_source: true,
    sig: token.sig,
    token: token.token
  };

  $.get(url, params, function(data) {
    var streams = parseHlsStreams(data);
    setupPlayer($player, streams);
  });
}

function parseHlsStreams(data) {
  var lines = (data || '').split('\n');
  if (lines[0] !== '#EXTM3U') {
    return [];
  }

  var streams = [];
  var inMedia = false;
  var streamName = null;

  lines.forEach(function(line) {
    if (!inMedia) {
      if (line.indexOf('#EXT-X-MEDIA') !== 0) {
        return;
      }

      streamName = (line.match(/NAME="(.*)"/) || [])[1];
      if (!streamName) {
        return;
      }

      inMedia = true;
    } else {
      if (line.indexOf('http') !== 0) {
        return;
      }

      streams.push({ name: streamName, url: line });

      inMedia = false;
    }
  });

  return streams;
}

function setupPlayer($flashPlayer, streams) {
  var playing = true;

  var $parent = $flashPlayer.parent();
  $parent.addClass('twitch-vlc-parent');

  var $playerContainer = $('<div class="twitch-vlc-container"></div>');

  var $player = $('<embed class="twitch-vlc" />');
  $player.attr('type', 'application/x-vlc-plugin');
  $player.attr('pluginspage', 'http://www.videolan.org');
  $player.attr('width', 0);
  $player.attr('height', 0);
  $player.attr('target', streams[0].url);
  $player.attr('controls', 'no');
  $player.attr('allowfullscreen', 'no');
  $playerContainer.append($player);

  var $controls = $('<div class="twitch-vlc-controls"></div>');
  $playerContainer.append($controls);

  var $togglePlay = $('<button type="button">Play/Pause</button>');
  $togglePlay.on('click', function() {
    $player[0].playlist.togglePause();
  });
  $controls.append($togglePlay);

  var $volumeSlider = $('<input type="range" min="0" max="100" />');
  $volumeSlider.val(100);
  $volumeSlider.on('input', function() {
    $player[0].audio.volume = $(this).val();
  });
  $controls.append($volumeSlider);

  var $toggleFullscreen = $('<button type="button">Toggle Fullscreen</button>');
  $toggleFullscreen.on('click', function() {
    $parent.toggleFullScreen();
    $parent.css('width', '100%');
  });
  $controls.append($toggleFullscreen);

  var hideControls = function() {
    $controls.hide();
  };
  var mouseTimeout = null;
  $playerContainer.on('mousemove', function() {
    $controls.show();
    if (mouseTimeout) {
      clearTimeout(mouseTimeout);
    }
    mouseTimeout = setTimeout(hideControls, 1000);
  });

  $parent.prepend($playerContainer);
  $flashPlayer.remove();

  var resize = function() {
    $player.attr('width', $parent.width());
    $player.attr('height', $parent.height());
  };

  resize();

  $parent.on('resize', resize);
}
