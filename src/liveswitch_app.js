import React from 'react';
import liveswitch from 'fm.liveswitch';
import Config from './liveswitch_config.json';

let localMedia;
let layoutManager;
let channel;
let connection;
let client;
let url = Config.gatewayUrl;
let appID = Config.applicationId;
let channelID = Config.channelId;
let sharedSecret = Config.sharedSecret;
let userId = "";

function startLs( ) {


  client = new liveswitch.Client(url, appID, userId);
  console.log(appID,
    client.getUserId(),
    client.getDeviceId(),
    client.getId(),
    null,
    [new liveswitch.ChannelClaim(channelID)],
    sharedSecret);

   let token = liveswitch.Token.generateClientRegisterToken(
    appID,
    client.getUserId(),
    client.getDeviceId(),
    client.getId(),
    null,
    [new liveswitch.ChannelClaim(channelID)],
    sharedSecret
  );

  client.register(token).then(function (channels) {
    channel = channels[0];
    console.log("connected to channel: " + channel.getId());
    token = liveswitch.Token.generateClientJoinToken(client, new liveswitch.ChannelClaim(channelID), sharedSecret);
    client.join(channelID, token).then(function (channel) {
      console.log("successfully joined channel");
      handleLocalMedia();
    }).fail(function (ex) {
      console.log("failed to join channel");
      return false;
    });
    return true;
  }).fail(function (ex) {
    console.log("registration failed");
    return false;
  });


}

function handleLocalMedia() {
  let audio = true;
  let video = new liveswitch.VideoConfig(540, 450, 10);
  localMedia = new liveswitch.LocalMedia(audio, video);

  localMedia.start().then(function (lm) {

    console.log("media capture started");
    layoutManager = new liveswitch.DomLayoutManager(document.getElementById("video"));
    layoutManager.setLocalView(localMedia.getView());

    openMcuConnection();

  }).fail(function (ex) {
    console.log(ex.message);
  });
}

function openMcuConnection() {
  let remoteMedia = new liveswitch.RemoteMedia();
  let audioStream = new liveswitch.AudioStream(localMedia, remoteMedia);
  let videoStream = new liveswitch.VideoStream(localMedia, remoteMedia);
  connection = channel.createMcuConnection(audioStream, videoStream);

  // Add the remote video view to the layout.
  if (remoteMedia.getView()) {
    remoteMedia.getView().id = 'remoteView_' + remoteMedia.getId();
  }
  layoutManager.addRemoteView(remoteMedia.getId(), remoteMedia.getView());

  connection.addOnStateChange(function (c) {
    if (c.getState() === liveswitch.ConnectionState.Closing || c.getState() === liveswitch.ConnectionState.Failing) {
      layoutManager.removeRemoteView(remoteMedia.getId());
    }
  });

  onClientRegistered(peerLeft, peerJoined);

  let videoLayout;
  channel.addOnMcuVideoLayout(function (vl) {
    videoLayout = vl;
    if (layoutManager != null) {
      layoutManager.layout();
    }
  });

  layoutManager.addOnLayout(function (layout) {
    if (connection != null) {
      liveswitch.LayoutUtility.floatLocalPreview(layout, videoLayout, connection.getId());
    }
  });

  connection.open().then(function (result) {
    console.log("mixed connection established");
  }).fail(function (ex) {
    console.log("an error occurred");
  });
}

function onClientRegistered(peerLeft, peerJoined) {
  try {
    channel.addOnRemoteClientJoin((remoteClientInfo) => {
      liveswitch.Log.info(`Remote client joined the channel (client ID: ${remoteClientInfo.getId()}, device ID: ${remoteClientInfo.getDeviceId()}, user ID: ${remoteClientInfo.getUserId()}, tag: ${remoteClientInfo.getTag()}).`);

      let n = remoteClientInfo.getUserAlias() != null ? remoteClientInfo.getUserAlias() : remoteClientInfo.getUserId();
      peerJoined(n);
    });
  }
  catch (e) {
    console.log("Error from App.js: " + e);
  }
  channel.addOnRemoteClientLeave((remoteClientInfo) => {
    let n = remoteClientInfo.getUserAlias() != null ? remoteClientInfo.getUserAlias() : remoteClientInfo.getUserId();
    peerLeft(n);

    liveswitch.Log.info(`Remote client left the channel (client ID: ${remoteClientInfo.getId()}, device ID: ${remoteClientInfo.getDeviceId()}, user ID: ${remoteClientInfo.getUserId()}, tag: ${remoteClientInfo.getTag()}).`);

  });

  // Monitor the channel remote upstream connection changes.
  channel.addOnRemoteUpstreamConnectionOpen((remoteConnectionInfo) => {
    liveswitch.Log.info(`Remote client opened upstream connection (connection ID: ${remoteConnectionInfo.getId()}, client ID: ${remoteConnectionInfo.getClientId()}, device ID: ${remoteConnectionInfo.getDeviceId()}, user ID: ${remoteConnectionInfo.getUserId()}, tag: ${remoteConnectionInfo.getTag()}).`);
      
  });
  channel.addOnRemoteUpstreamConnectionClose((remoteConnectionInfo) => {
    liveswitch.Log.info(`Remote client closed upstream connection (connection ID: ${remoteConnectionInfo.getId()}, client ID: ${remoteConnectionInfo.getClientId()}, device ID: ${remoteConnectionInfo.getDeviceId()}, user ID: ${remoteConnectionInfo.getUserId()}, tag: ${remoteConnectionInfo.getTag()}).`); 
  });
}
function stop() {
  localMedia.stop().then((o) => {
  connection.close().then(function (result) {
    layoutManager.unsetLocalView();
    localMedia.destroy();

    console.log("connection closed");
  }).fail(function (ex) {
    console.log("an error occurred");
  });

  client.unregister().then(function (result) {
    console.log("unregistration succeeded");
  }).fail(function (ex) {
    console.log("unregistration failed");
  });
}, (ex) => {
  console.log(ex);
});
}

let peerLeft = function (name) {
  console.log( name + ' left.');
};

let peerJoined = function (name) {
  console.log( name + ' joined.');
};

class App extends React.Component {
  
  state = {
    url: Config.gatewayUrl,
    appID: "react-app",
    userName: "Anonymous",
  }

  constructor(props) {
    super(props);
    startLs();
  }

  componentWillUnmount() {
    stop();
  }

  render() {
    return (
      <div>
              <div id="video"></div>
          
      </div>      
    );
  }
}
export default App;


