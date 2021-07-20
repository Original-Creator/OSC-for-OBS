// A bridge between OBS websocket and OSC

// Install libs: npm install
// Run: npm start

const chalk = require("chalk");
const OBSWebSocket = require("obs-websocket-js");
const { Client, Server } = require("node-osc");
const obs = new OBSWebSocket();

// OBS Config
const obsIp = "127.0.0.1";
const obsPort = 4444;
const obsPassword = "secret";
// OSC Server (IN) Config
const oscServerIp = "0.0.0.0";  // Listen IP, set to 0.0.0.0 to listen on all interfaces
const oscPortIn = 3333;
// OSC Client (OUT) Config - i.e. sending OSC to QLab
const oscClientIp = "127.0.0.1";  // QLab IP
const oscPortOut = 53000;
// Enable OBS -> OSC Control
const enableObs2Osc = false;

// Cache last transition so we know how to trigger it (cut works differently to all the others)
// See https://github.com/Palakis/obs-websocket/blob/4.x-current/docs/generated/protocol.md#transitionbegin
var lastTransition = null;


// Connect to OBS
obs.connect({
    address: obsIp + ":" + obsPort,
    password: obsPassword
})
.then(() => {
    console.log(`[+] Connected to OBS Websocket OK (${obsIp}:${obsPort})`);
    return obs.send("GetSceneList");
})
.then(data => {
    // Pull current screen transition
    obs.send("GetCurrentTransition").then(data => {
        lastTransition = data.name;
        console.log(`[+] Cached current transition: "${data.name}"`);
    });
    // Log total scenes
    console.log(`\n${data.scenes.length} Available Scenes:`);
    data.scenes.forEach((thing, index) => {
        console.log("    " + (index + 1) + " - " + thing.name);
    });
    // Log OSC scene syntax
    console.log('\n-- Use "/scene [index]" For OSC Control --\n');
})
.catch(err => {
    console.log(err);
    console.log(chalk.red("[!] Make Sure OBS is Running and Websocket IP/port/password are correct!"));
});


// Handler to Avoid Uncaught Exceptions.
obs.on("error", err => {
    console.error("socket error:", err);
});

// Connect to OSC
const client = new Client(oscClientIp, oscPortOut);
var server = new Server(oscPortIn, oscServerIp);

// OSC Server (IN)
server.on("listening", () => {
    console.log(`[+] OSC Server is listening on ${oscServerIp}:${oscPortIn}`);
    console.log(`[+] OSC Server is sending back on ${oscClientIp}:${oscPortOut}`);
});

// OSC -> OBS
server.on("message", (msg) => {
    /*
     * SCENE (transition to immediately)
     */

    // Trigger scene by index number
    if (msg[0] === "/scene" && typeof msg[1] === "number") {
        let oscMessage = msg[1] - 1;  // Convert index number to start at 1
        oscMessage = Math.floor(oscMessage);  // Converts any float argument to lowest integer
        return obs.send("GetSceneList").then(data => {
            console.log(`OSC IN: ${msg[0]} ${oscMessage + 1} (${data.scenes[oscMessage].name})`);
            obs.send("SetCurrentScene", {
                "scene-name": data.scenes[oscMessage].name,
            });
        }).catch(() => {
            console.log("Error: Out Of '/scene' Range");
        });
    }

    // Trigger scene if argument is a string and contains a space
    else if (msg[0] === "/scene" && msg.length > 2) {
        let firstIndex = msg.shift();
        let oscMultiArg = msg.join(" ");
        return obs.send("GetSceneList").then(data => {
            console.log(`OSC IN: ${firstIndex} ${oscMultiArg}`);
            obs.send("SetCurrentScene", {
                "scene-name": oscMultiArg,
            }).catch(() => {
                  console.log(chalk.red(`[!] There is no scene '${oscMultiArg}' in OBS. Double check case sensitivity.`));
            });
        }).catch((err) => {
            console.log(err);
        });
    }

      //Trigger Scene if Argument is a String
      else if (msg[0] === "/scene" && typeof msg[1] === 'string'){          //When OSC Recieves a /scene do...
        var oscMessage = msg[1]; 
      return obs.send('GetSceneList').then(data => {                         //Request Scene List Array
          console.log(`OSC IN: ${msg[0]} ${oscMessage}`)
          obs.send("SetCurrentScene", {
              'scene-name': oscMessage                                       //Set to Scene from OSC
              }).catch(() => {
                console.log(chalk.red(`[!] There is no scene "${msg[1]}" in OBS. Double check case sensitivity.`));
              })
          }).catch((err) => {
              console.log(err)                                                            //Catch Error
          });
      } 

      //Trigger Scene if Scene Name is in the OSC String
      else if (msg[0].includes('/scene') && msg.length === 1){
        var msgArray = msg[0].split("/")
        msgArray.shift()
        msgArray.shift()
        obs.send("SetCurrentScene", {
            'scene-name': msgArray[0].split("_").join(" ").toString(),                                          //Set to Scene from OSC
            }).catch(() => {
              console.log(chalk.red(`[!] There is no Scene "${msgArray}" in OBS. Double check case sensitivity.`));
            }).catch((err) => {
            console.log(err)                                                //Catch Error
        });

      }

    /*
    * PREVIEW SCENE
    */

    // Preview scene with scene name as argument (no spaces)
    else if (msg[0] === "/previewScene" && typeof msg[1] === "string") {
        let sceneName = msg[1];
        console.log(`OSC IN: ${msg[0]} ${sceneName}`)
        obs.send("SetPreviewScene", {
            "scene-name": sceneName
        }).catch(() => {
            console.log(chalk.red(`[!] Failed to set preview scene ${sceneName}. Is studio mode enabled?`));
        });
    }

      
      //Triggers to "GO" to the Next Scene
      else if (msg[0] === "/go"){                                          //When OSC Recieves a /go do...
            
        return obs.send('GetSceneList').then(data => {                      //Request Scene List Array
            
            var cleanArray = []
            var rawSceneList = data                                         //Assign Get Scene List 'data' to variable 
            data.scenes.forEach(element => {cleanArray.push(element.name)}); //Converting Scene List To a Cleaner(Less Nested) Array (Getting the Desired Nested Values) 
            return obs.send("GetCurrentScene").then(data => {               //Request Current Scene Name
                var currentSceneIndex = cleanArray.indexOf(data.name)       //Get the Index of the Current Scene Referenced from the Clean Array
                if (currentSceneIndex + 1 >= rawSceneList.scenes.length){   //When the Current Scene is More than the Total Scenes...
                obs.send("SetCurrentScene", {
                        'scene-name': rawSceneList.scenes[0].name           //Set the Scene to First Scene
                })
             } else {
                obs.send("SetCurrentScene", {
                    'scene-name': rawSceneList.scenes[currentSceneIndex + 1].name  //Set Scene to Next Scene (Referenced from the Current Scene and Array)
                    })   
                }
        }).catch(() => {
            console.log(chalk.red("[!] Invalid OSC Message"));                              //Catch Error
            });
        })
    } 
    
    //Triggers Previous Scene to go "BACK"
    else if (msg[0] === "/back"){                                                 //Same Concept as Above Except Going to the Previous Scene

        return obs.send('GetSceneList').then(data => {
            
            var cleanArray = []
            var rawSceneList = data
            data.scenes.forEach(element => {cleanArray.push(element.name)});
            return obs.send("GetCurrentScene").then(data => {
                var currentSceneIndex = cleanArray.indexOf(data.name)
                if (currentSceneIndex - 1 <= -1){
                obs.send("SetCurrentScene", {
                        'scene-name': rawSceneList.scenes[rawSceneList.scenes.length - 1].name 
                })
             } else {
                obs.send("SetCurrentScene", {
                    'scene-name': rawSceneList.scenes[currentSceneIndex - 1].name
                    })   
                }
        }).catch(() => {
            console.log(chalk.red("[!] Invalid OSC Message"));
            });
        });
    }

    //Triggers Start Recording
    else if (msg[0] === "/startRecording"){
        obs.send("StartRecording").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Stop Recording
    else if (msg[0] === "/stopRecording"){
        obs.send("StopRecording").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Toggle Recording
    else if (msg[0] === "/toggleRecording"){
        obs.send("StartStopRecording").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Start Streaming
    else if (msg[0] === "/startStreaming"){
        obs.send("StartStreaming").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Stop Streaming
    else if (msg[0] === "/stopStreaming"){
        obs.send("StopStreaming").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Toggle Streaming
    else if (msg[0] === "/toggleStreaming"){
        obs.send("StartStopStreaming").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Pause Recording
    else if (msg[0] === "/pauseRecording"){
        obs.send("PauseRecording").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }
    //Triggers Resume Recording
    else if (msg[0] === "/resumeRecording"){
        obs.send("ResumeRecording").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Enable Studio Mode
    else if (msg[0] === "/enableStudioMode"){
        obs.send("EnableStudioMode").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Disable Studio Mode
    else if (msg[0] === "/disableStudioMode"){
        obs.send("DisableStudioMode").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Toggle Studio Mode
    else if (msg[0] === "/toggleStudioMode"){
        obs.send("ToggleStudioMode").catch((err) => {
            console.log(chalk.red(`[!] ${err.error}`));
        });
    }

    //Triggers Source Visibility On/Off
    else if (msg[0].includes('visible')){
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        var visible;
        if(msg[1] === 0 || msg[1] === 'off'){
            visible = false
        } else if(msg[1] === 1 || msg[1] === 'on'){
            visible = true
        }
        obs.send("SetSceneItemProperties", {
            'scene-name': msgArray[0],
            'item': msgArray[1],
            'visible': visible,
        }).catch(() => {
            console.log(chalk.red("[!] Invalid syntax. Make sure there are NO SPACES in scene name and source name. /[sceneName]/[sourceName]/visible 0 or 1, e.g.: /Wide/VOX/visible 1"));
        });
    }

    //Triggers Filter Visibility On/Off
    else if (msg[0].includes('filterVisibility')){
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        var visiblef;
        if(msg[1] === 0 || msg[1] === 'off'){
            visiblef = false
        } else if(msg[1] === 1 || msg[1] === 'on'){
            visiblef = true
        }
        obs.send("SetSourceFilterVisibility", {
            'sourceName': msgArray[0].split('_').join(' '),
            'filterName': msgArray[1].split('_').join(' '),
            'filterEnabled': visiblef
        }).catch(() => {
            console.log(chalk.red("[!] Invalid syntax. Make sure there are NO SPACES in source name and filter name. /[sourceName]/[filterName]/filterVisibility 0 or 1, e.g.: /VOX/chroma/filterVisibility 1"));
        });
    } 

    //Triggers the Source Opacity (via Filter > Color Correction)
    else if (msg[0].includes('opacity')){
        console.log(`OSC IN: ${msg[0]} ${msg[1]}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        obs.send("SetSourceFilterSettings", {
           'sourceName': msgArray[0].split('_').join(' '),
           'filterName': msgArray[1].split('_').join(' '),
           'filterSettings': {'opacity' : msg[1]*100}
        }).catch(() => {
            console.log(chalk.red("[!] Opacity command incorrect syntax."));
        });
    }

    //Set Transition Type and Duration
    else if (msg[0] === '/transition'){
        if (msg[1] === "Cut" || msg[1] === "Stinger") {
            console.log(`OSC IN: ${msg[0]} ${msg[1]}`)
            obs.send("SetCurrentTransition", {
                'transition-name': msg[1].toString()
            }).catch(() => {
                console.log("Whoops")
            })
        } else if(msg[1] === "Fade" || msg[1] === "Move" || msg[1] === "Luma_Wipe" || msg[1] === "Fade_to_Color" || msg[1] === "Slide" || msg[1] === "Swipe"){
            if (msg[2] === undefined){
                obs.send("GetTransitionDuration").then(data => {
                    var tranisionTime = data["transition-duration"]
                    console.log(`OSC IN: ${msg[0]} ${msg[1]}\nCurrent Duration: ${tranisionTime}`)
                })
            } else {
            console.log(`OSC IN: ${msg[0]} ${msg[1]} ${msg[2]}`)
            }
            var makeSpace = msg[1].split('_').join(' ');  // TODO get rid of confusing replace and just disallow spaces in scene names
        obs.send("SetCurrentTransition", {
            'transition-name': makeSpace.toString()
        })
        if(msg.length === 3){
        obs.send("SetTransitionDuration", {
            'duration': msg[2]
        })}
        } else {
            console.log(chalk.red("[!] Invalid transition name. If it contains spaces use '_' instead."));
        } 
        
    } 
    
    //Source Position Translate
    else if (msg[0].includes('position')){
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        var x = msg[1] + 960
        var y = msg[2] - (msg[2] * 2)
        obs.send("SetSceneItemProperties", {
            'scene-name': msgArray[0].toString().split('_').join(' '),
            'item': msgArray[1].toString().split('_').join(' '),
            'position': { 'x': x, 'y': y + 540}
        }).catch(() => {
            console.log(chalk.red("[!] Invalid position syntax"));
        });
    }

    //Source Scale Translate
    else if (msg[0].includes('scale')){
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        var visible;
        obs.send("SetSceneItemProperties", {
            'scene-name': msgArray[0].split('_').join(' ').toString(),
            'item': msgArray[1].split('_').join(' ').toString(),
            'scale': { 'x': msg[1], 'y': msg[1]}
        }).catch(() => {
            console.log(chalk.red("[!] Invalid scale syntax. Make sure there are NO SPACES in scene name and source name. /[sceneName]/[sourceName]/scale 0 or 1, e.g.: /Wide/VOX/scale 1"));
        });
    }

        //Source Rotation Translate
        else if (msg[0].includes('rotate')){
            console.log(`OSC IN: ${msg}`)
            var msgArray = msg[0].split("/")
            msgArray.shift()
            obs.send("SetSceneItemProperties", {
                'scene-name': msgArray[0].split('_').join(' ').toString(),
                'item': msgArray[1].split('_').join(' ').toString(),
                'rotation': msg[1]
            }).catch(() => {
                console.log(chalk.red("[!] Invalid rotation syntax. Make sure there are NO SPACES in scene name and source name. /[sceneName]/[sourceName]/rotate 0 or 1, e.g.: /Wide/VOX/rotate 1"));
            });
        } 

    // ----- TouchOSC COMMANDS: ------

    //Source Position Select Move
    else if (msg[0] === '/move'){
        return obs.send("GetCurrentScene").then(data => {
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        var x = Math.floor((msg[2]*2000))
        var y = Math.floor((msg[1]*2000) + 960)
        console.log(x + " " + y)
        obs.send("SetSceneItemProperties", {
            'scene-name': data.name,
            'item': currentSceneItem,
            'position': { 'x': x + 540, 'y': y, 'alignment': 0}
        }).catch(() => {
            console.log(chalk.red("[!] Invalid position syntax"));
        });
    });
    }

        //Source Position Select MoveX
        else if (msg[0] === '/movex'){
            return obs.send("GetCurrentScene").then(data => {
            console.log(`OSC IN: ${msg}`)
            var msgArray = msg[0].split("/")
            msgArray.shift()
            var x = Math.floor((msg[1]*2000))
            var y = Math.floor((msg[1]*2000) + 960)
            console.log(x + " " + y)
            obs.send("SetSceneItemProperties", {
                'scene-name': data.name,
                'item': currentSceneItem,
                'position': { 'x': x + 540, 'alignment': 0}
            }).catch(() => {
                console.log(chalk.red("[!] Invalid position syntax"));
            })
        })
        }

        //Source Position Select MoveY
        else if (msg[0] === '/movey'){
            return obs.send("GetCurrentScene").then(data => {
            console.log(`OSC IN: ${msg}`)
            var msgArray = msg[0].split("/")
            msgArray.shift()
            var x = Math.floor((msg[2]*2000))
            var y = Math.floor((msg[1]*2000) + 960)
            console.log(x + " " + y)
            obs.send("SetSceneItemProperties", {
                'scene-name': data.name,
                'item': currentSceneItem,
                'position': { 'y': y, 'alignment': 0}
            }).catch(() => {
                console.log(chalk.red("[!] Invalid position syntax"));
            })
        })
        }

        
    //Source Align
    else if (msg[0] === '/align'){
        return obs.send("GetCurrentScene").then(data => {
        console.log(`OSC IN: ${msg}`)
        var x = 0 + 960
        var y = 0 + 540
        obs.send("SetSceneItemProperties", {
            'scene-name': data.name.toString(),
            'item': currentSceneItem,
            'position': {'x': x, 'y':y, 'alignment': msg[1]}
        }).catch(() => {
            console.log(chalk.red("[!] Select a scene item in OBS for alignment"));
        })
    })
    }

    //Set Transition Override
    else if(msg[0].includes('/transOverrideType')){
        console.log(`OSC IN: ${msg}`)
        var msgArray = msg[0].split("/")
        msgArray.shift()
        console.log("Messge array: " + msgArray)
        return obs.send("GetCurrentScene").then(data => {
        obs.send("SetSceneTransitionOverride", {
            'sceneName': data.name,
            'transitionName': msgArray[1].toString(),
        })
    })
    }

    //Set Transition Override
    else if(msg[0] === '/transOverrideDuration'){
        let currentSceneName
        console.log(`OSC IN: ${msg}`)
        return obs.send("GetCurrentScene").then(data => {
            currentSceneName = data.name
        return obs.send("GetSceneTransitionOverride", {
            'sceneName': currentSceneName
        }).then(data => {
            obs.send("SetSceneTransitionOverride", {
                'sceneName': currentSceneName,
                'transitionName': data.transitionName,
                'transitionDuration': Math.floor(msg[1])
            })
        })
        })
    }

    //Source Size
    else if (msg[0] === '/size'){
        return obs.send("GetCurrentScene").then(data => {
        console.log(`OSC IN: ${msg}`)
        obs.send("SetSceneItemProperties", {
            'scene-name': data.name.toString(),
            'item': currentSceneItem,
            'scale': {'x': msg[1], 'y': msg[1]}
        }).catch(() => {
            console.log(chalk.red("Error: Select a scene item in OBS for size"));
        })
    })
    }

    //Log Error
    else {
        console.log(chalk.red("[!] Invalid OSC command. Please refer to Node OBSosc on Github for command list"));
    }
});

// OBS -> OSC
function sceneTrigger(sceneName) {
    // Extract QLab cue number from OBS scene if specified e.g. "My Scene [target]"
    var cueNumber = sceneName.substring(
        sceneName.lastIndexOf("[") + 1, sceneName.lastIndexOf("]")
    );
    if (!cueNumber) return;  // Scene doesn't request any cues to be triggered
    console.log(`  Cue triggered: "${cueNumber}"`);
    // Trigger cue with extracted cue number
    client.send(`/cue/${cueNumber}/start`, (err) => {
        if (err) console.error(err);
    });
}
obs.on("SwitchScenes", data => {
    if (enableObs2Osc && lastTransition === "Cut") {
        console.log(`Scene change: ${data.sceneName} (lastTransition: "${lastTransition}")`);
        sceneTrigger(data.sceneName);
    }
});
obs.on("TransitionBegin", data => {
    if (enableObs2Osc && lastTransition !== "Cut") {
        console.log(`Transition started: ${data.toScene} (lastTransition: "${lastTransition}")`);
        sceneTrigger(data.toScene);
    }
});
obs.on("SwitchTransition", data => {
    console.log(`[+] Transition changed to: "${data.transitionName}"`);
    lastTransition = data.transitionName;
});
