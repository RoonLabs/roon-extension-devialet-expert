# [Roon](https://roonlabs.com) [Extension](node-roon-api) to provide [source switching, standby](https://github.com/RoonLabs/node-roon-api-source-control), and [volume control](https://github.com/RoonLabs/node-roon-api-volume-control) for [Devialet](http://en.devialet.com/)'s [Expert](http://en.devialet.com/expertpro/discover) via [RS232](https://github.com/RoonLabs/node-devialet-expert)

This extension connects to your Devialet Expert via RS232, and allows Roon to control it's volume in-app, as well as standby and source switching.

For example, let's say you have your Expert hooked up via USB.

$a device to a network bridge device like the Sonic Orbiter or MicroRendu., like the bbbbvia SPDIFb.

After running this extension and connecting it to your zone, 

Configure your Expert:

* Link speed: 115200
* Identifier: Devialet
* Mode -> Command Acknowledge = TRUE
* Mode -> Auto Cchange notification = TRUE
* Mode -> Echo chaining = FALSE

Initialization:

```javascript
var DevialetExpert = require("node-devialet-expert");
var d = new DevialetExpert();
```

Listening to events:

```javascript
d.on('status', function(status) { });
d.on('changed', function(property, value) { });
```

`status` can be one of the following:

* `'connecting'`
* `'initializing'`
* `'connected'`
* `'disconnected'`

`property` can be one of the following:

* `'power'`
* `'volume'`
* `'source'`
* `'mute'`
* `'phase'`
* `'preout'`
* `'riaa'`
* `'subsonic_filter'`
* `'subwoofer'`

Starting/Stopping the connection to the Devialet Expert device:

```javascript
d.start(port, baud);
```

* `port` should be like `'/dev/cu.usbserial'` or something similar on MacOS or Linux, or `'COM3'` on Windows
* `baud` should be like `115200`, or whatever you configured your Devialet to be (see above)



```javascript
d.stop();
```
