const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const fs = require('fs');

const eventEmitter = new EventEmitter();

logFiles = [];
creatingSnapshodNum = 0;
loadFinished = false;

function rectAcreage(rect) {
    return Math.round((rect.bottom - rect.top) * (rect.right - rect.left));
}

async function delay(t, val) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve(val);
        }, t);
    });
}

async function closePageAndBrowser(page, browser) {
    try {
        await page.close();
        await browser.close();
    }
    catch (e) {}
}

eventEmitter.on("domCreated", async args => {
    try {
        mainDoc = await args.client.send("DOM.getDocument", {pierce: true});
        inputs = await args.client.send("DOM.querySelectorAll", {nodeId: mainDoc.root.nodeId, selector: "input"});

        console.log("Inputs:", inputs);
        inputs.nodeIds.forEach(async id => {
            remoteObj = await args.client.send("DOM.resolveNode", {nodeId: id});
        });
    }
    catch (e) {}
});

eventEmitter.once('load', async args => {
    if (!loadFinished || creatingSnapshodNum !== 0) return;

    await closePageAndBrowser(args.page, args.browser);
    eventEmitter.emit('loadFinish');
});

eventEmitter.on("createSnapshot", () => {
    creatingSnapshodNum += 1;
});

eventEmitter.on("finishSnapshot", () => {
    creatingSnapshodNum -= 1;
});

eventEmitter.on('loadFinish', () => {
    console.log("Paint captured:", logFiles);
    
    rects = [];
    acreages = [];

    logFiles.forEach(lf => {
        var content = JSON.parse(fs.readFileSync(`${lf}.json`));
        content.commandLog.forEach(log => {
            switch (log.method) {
                case "drawRect":
                    rects.push(log.params.rect);
                    break;
                case "drawImageRect":
                    rects.push(log.params.dst);
                    break;
                default:
                    break; 
            }
        });

        actual_paint_acreage = 0;
        rects.forEach(r => {
            actual_paint_acreage += rectAcreage(r);
        });
        acreages.push(actual_paint_acreage);
    });

    console.log(acreages);

    logFiles.forEach(lf => {
        fs.unlinkSync(`${lf}.json`);
    });
});

puppeteer.launch().then(async browser => {
    page = await browser.newPage();
    await page.setViewport({width: 1000, height: 800});

    const client = await page.target().createCDPSession();

    page.on('load', async () => {
        console.log("Load triggered:", Date.now());

        await delay(2000);
        loadFinished = true;
        eventEmitter.emit('load', {page, browser});
    });

    // await client.send("Debugger.enable");
    // await client.send("DOM.enable");
    // await client.send("Runtime.enable");
    await client.send("LayerTree.enable");
    
    client.on("Debugger.scriptParsed", async args => {
        console.log("DEBUG.SrciptParsed", args.scriptId, args.url);
    });

    client.on("DOM.attributeModified", async args => {
        console.log("DOM.AttrMod:", args.nodeId, args.name, args.value);
    });

    client.on("DOM.childNodeInserted", async args => {
        console.log("DOM.ChildNodeInsert:", args.parentNodeId, args.previousNodeId, args.node);
    });

    client.on("DOM.documentUpdated", () => {
        console.log("DOM.DocUpdate");
        eventEmitter.emit("domCreated", {page, client});
    });

    client.on("Runtime.bindingCalled", args => {
        console.log("Runtime.BindCall:", args.name, args.payload);
    });

    client.on("Runtime.consoleAPICalled", args => {
        console.log("Runtime.ConsoleAPI:", args.type, args.args);
    });

    client.on("Runtime.executionContextCreated", args => {
        console.log("Runtime.ContextCreate:", args.context.name);
    });

    client.on("LayerTree.layerPainted", async args => {
        if (loadFinished) return;
        eventEmitter.emit('createSnapshot');

        try {
            snapshotId = await client.send("LayerTree.makeSnapshot", {layerId: args.layerId});
            commandLog = await client.send("LayerTree.snapshotCommandLog", {snapshotId: snapshotId.snapshotId});
            if (commandLog) {
                now = Date.now();
                logFiles.push(now);
                fs.writeFileSync(`${now}.json`, JSON.stringify(commandLog));
            }
        }
        catch (e) {
            // console.log(e);
        }

        eventEmitter.emit("finishSnapshot");
        eventEmitter.emit("load", {page, browser});
    }); 

    await page.goto("http://localhost:8000");
});
