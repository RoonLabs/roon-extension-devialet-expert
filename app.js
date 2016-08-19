"use strict";

var roon                 = require("node-roon-api"),
    DevialetExpert       = require("node-devialet-expert"),
    RoonApi              = require("node-roon-api"),
    RoonApiSettings      = require('node-roon-api-settings'),
    RoonApiStatus        = require('node-roon-api-status'),
    RoonApiVolumeControl = require('node-roon-api-volume-control'),
    RoonApiSourceControl = require('node-roon-api-source-control');

var devialet = { rs232: new DevialetExpert() };

var roon = new RoonApi();

var mysettings = roon.load_config("settings") || {
    serialport: "",
    source:     "USB",
};

function makelayout(settings) {
    var l = {
	layout:    [],
	has_error: false
    };

    l.layout.push({
        type:      "string",
        title:     "Serial Port",
        maxlength: 256,
        setting:   "serialport",
    });

    l.layout.push({
        type:    "dropdown",
        title:   "Source for Convenience Switch",
        values:  [
            { value: "USB"       },
            { value: "AES/EBU"   },
            { value: "Digital 1" },
            { value: "Digital 2" },
            { value: "Digital 3" },
            { value: "Digital 4" },
            { value: "Phono 2"   },
            { value: "Line 1"    },
            { value: "Line 2"    },
            { value: "Phono"     },
            { value: "Optical 1" },
            { value: "Optical 2" },
            { value: "HDMI"      },
            { value: "Air"       },
        ],
        setting: "source",
    });

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    save_settings: function(req, isdryrun, settings) {
	let l = makelayout(settings);
	if (l.has_error) {
	    req.send_complete("NotValid", { settings: settings, layout: l.layout });
            return;
        }
        if (!isdryrun) {
            var oldport = mysettings.serialport;
            mysettings = settings;
            svc_settings.set_settings(mysettings, l.layout);
            roon.save_config("settings", mysettings);
            if (oldport != settings.serialport)
                setup_serial_port(settings.serialport);
        }
        req.send_complete("Success", { settings: settings, layout: l.layout });
    }
});
svc_settings.set_settings(mysettings, makelayout(mysettings).layout);

var svc_status = new RoonApiStatus(roon);
var svc_volume_control = new RoonApiVolumeControl(roon);
var svc_source_control = new RoonApiSourceControl(roon);

function setup_serial_port(port) {
    devialet.rs232.stop();
    if (devialet.source_control) { devialet.source_control.destroy(); delete(devialet.source_control); }
    if (devialet.volume_control)   { devialet.volume_control.destroy();   delete(devialet.volume_control);   }

    if (port)
        devialet.rs232.start(port, 115200);
    else
        svc_status.set_status("Not configured, please check settings.", true);
}

devialet.rs232.on('status', ev_status);
devialet.rs232.on('changed', ev_changed);
setup_serial_port(mysettings.serialport);
    
function ev_status(status) {
    let rs232 = devialet.rs232;

    if (status == "disconnected") {
        svc_status.set_status("Could not connect to Devialet Expert on \"" + mysettings.serialport + "\"", true);
        if (devialet.source_control) { devialet.source_control.destroy(); delete(devialet.source_control); }
        if (devialet.volume_control)   { devialet.volume_control.destroy();   delete(devialet.volume_control);   }

    } else if (status == "connected") {
        svc_status.set_status("Connected to Devialet Expert", false);
        devialet.source_control = svc_source_control.new_device({
            state: {
                display_name:     "Devialet Expert", // XXX need better less generic name -- can we get serial number from the RS232?
                supports_standby: true,
                status:           !rs232.get_power() ? "standby" : (rs232.get_source() == mysettings.source ? "selected" : "deselected")
            },
            convenience_switch: function (req) {
                devialet.set_source(mysettings.source, err => { req.send_complete(err ? "Failed" : "Success"); });
            },
            standby: function (req) {
                this.state.status = "standby";
                devialet.set_power(0, err => { req.send_complete(err ? "Failed" : "Success"); });
            }
        });

        devialet.volume_control = svc_volume_control.new_device({
            state: {
                display_name: "Devialet Expert", // XXX need better less generic name -- can we get serial number from the RS232?
                type:         "db",
                min:          -97.5,
                max:          30,
                value:        rs232.get_volume(),
                step:         0.5,
                is_muted:     !!rs232.get_mute()
            },
            set_volume: function (req, mode, value) {
                rs232.set_volume(mode == "absolute" ? value : (rs232.get_volume() + value),
                                    (err) => { req.send_complete(err ? "Failed" : "Success"); });
            },
            set_mute: function (req, action) {
                rs232.set_mute(action == "on" ? 1 : (action == "off" ? 0 : "!"),
                                (err) => { req.send_complete(err ? "Failed" : "Success"); });
            }
        });
    } else if (status == "initializing") {
        svc_status.set_status("Connecting to Devialet Expert on \"" + mysettings.serialport + "\"", true);
    }
}

function ev_changed(name, val) {
    let rs232 = devialet.rs232;
    if (name == "volume" && devialet.volume_control) devialet.volume_control.update_state({ value: val });
    if (name == "mute"   && devialet.volume_control) devialet.volume_control.update_state({ is_muted: !!val });
    if ((name == "source" || name == "power") && devialet.source_control)
        devialet.source_control.update_state({ status: !rs232.get_power() ? "standby" : (val == mysettings.source ? "selected" : "deselected") });
}

var extension = roon.extension({
    extension_id:        'com.roonlabs.devialet.expert',
    display_name:        'Devialet Expert Volume and Source Control',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    website:             'https://github.com/RoonLabs/roon-extension-devialet-expert',
    required_services:   [ ],
    optional_services:   [ ],
    provided_services:   [ svc_volume_control, svc_source_control, svc_settings, svc_status ]
});

var go;
go = function() { extension.connect("localhost:9100", () => setTimeout(go, 3000)); };
go();
