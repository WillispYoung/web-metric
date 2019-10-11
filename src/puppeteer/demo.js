const puppeteer = require("puppeteer");

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();

    // ---> Set viewport size.
    //var width = 1920, height = 1080;
    // await page.setViewport({
    //     width: 600,
    //     height: 1000
    // });
    //console.log(page.viewport().width, page.viewport().height);

    // ---> Record layer change and other events periodically.
    var interval = setInterval(async function() {
        const now = new Date().getTime();
        // console.log(now);

        // await page.screenshot({ path: 'ss/' + now + ".png" });

        try {
            // Remove same DIVs.
            const allDivs = await page.$$('div');
            // console.log("Number of DIVs:", allDivs.length);

            const visibleDivs = [];
            // var visibleCount = 0;
// 
            for (var i = 0; i < allDivs.length; i++) {
                var bbox = await allDivs[i].boundingBox();
                if (bbox != null) {
                    if (visibleDivs.length == 0) {
                        visibleDivs.push(bbox);
                        continue;
                    }

                    for (var j = 0; j < visibleDivs.length; j++) {
                        if (bbox.x == visibleDivs[j].x &&
                            bbox.y == visibleDivs[j].y &&
                            bbox.width == visibleDivs[j].width &&
                            bbox.height == visibleDivs[j].height)
                            continue;
                        else {
                            visibleDivs.push(bbox);
                            break;
                        }
                    }
                }
                // if (bbox !== null) {
                //     visibleCount += 1;
                //     //console.log(bbox);
                //     console.log("X:", bbox.x, "Y:", bbox.y,
                //         "Width:", bbox.width, "Height:", bbox.height);
                // }
            }

            // console.log("Visible Count:", visibleDivs.length);
        } catch (e) {
            // console.log(e);
        }
    }, 100); // This interval is important.

    page.on("domcontentloaded", async function() {
        console.log('domContentLoaded');
        // await page.screenshot({ path: 'dcl.png' });
    });

    page.on('load', async function() {
        console.log('Page Loaded');
        clearInterval(interval);

        // await page.screenshot({ path: 'l.png' });
        // await browser.close();
    });

    // ---> Combine CDP together.
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on("Network.responseReceived", async function(requestId) {
            try {
                var response = await client.send('Network.getResponseBody', requestId);
                console.log(response.base64Encoded);
                if (!response.base64Encoded) {	// --> Contains JavaScript files.
                	console.log(response.body);
            	}
            } catch (e) {
            	// console.log(e);
            	console.log("Error receiving response.");
            }
        });
    } catch (e) {
    	console.log(e);
        console.log("Error creating CDP session.");
    }

    // --> Always put this line at the end of file!
    await page.goto('https://www.zhihu.com/topic/19565870/');

    // ---> Hold command line window.
    var input = process.stdin.read();
});