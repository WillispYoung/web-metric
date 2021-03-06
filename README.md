# Web Performance Exploration

Implementation on the measurement of several metric (including potentially new ones) for web pages, with other findings and analysis.

### Definition

Web performance of a certain page is the performance of **the process that certain browser exhibits certain page**. The factors that mainly influence such process are *browser's mechanism* and *page's architecture*, and underlying factors include *network status*, *machine configuration* and others. 

### Computation

#### Data Credibility

There are mainly 3 data sources:
1. DevTools Tracing
2. DevTools Backend
3. In-Page Script

Tracing (1) is in microsecond granularity, while the others are in milliseconds. Events monitored at Backend (2) is later than the others, which is understandable and the gap between them are not very great. Here we take **Tracing (1) as the ground truth** for the process of page loading. Yet beware that timestamp in Tracing (1) isn't simply normal timestamp value multiplying 1000; the zero timepoint in Tracing (1) is different from normal Date.

As Tracing (1) cannot keep dynamic information, *DOM snapshot* and *Layer snapshot* are captured to represent time-sensitive information. With simple experiment, capturing DOM / Layer snapshots would take up to 100 ms (usually happens for capturing the **1st** DOM snapshot), while normally no more than 30 ms. This delay is supposed to be caused by CPU workloads, yet seemed as acceptable and would not cause great inaccuracy. 

To avoid influencing page load process, we would only user Tracing (1) and Backend (2) as the data sources. [ **HOW TO ADDRESS SUCH INFLUENCE?** ]

Tracing and Backend **Clock Synchronization**: the `Navigation Start` timestamp is treated as the start of page loading in Tracing file, yet at Backend, the timestamp before `Page.goto(url)` is treated as the start.

* Events

    1. `CSS.styleSheetAdded`
    2. `Debugger.scriptParsed`
    3. `LayerTree.layerPainted`
    4. `Network.requestWillBeSent`
    5. `Network.responseReceived`

Event (1) accounts for when a stylesheet is completely parsed, event (2) when a script is completely parsed. Event (3) accounts for an actual paint, when this event is triggered, we need to capture DOM snapshot and command log for relative layer snapshot. Event (4) and (5) account for request and response monitored, which are mapped according to `requestId`. 

As snapshots can only be captured at Backend, we only monitor Event (3), and access other events from Tracing.

#### Computation

With each paint event triggered, we can capture a sequence of paint commands. Each paint command of interest can be translated into an update to the viewport. Yet there can be many repeated paint commands that produce identical updates, we treat them as **Redundant Paint**. Only those that make the viewport "different" should be treated as **Effective Paint**.

* Paint Commands of Interest
    1. drawRect
    2. drawImageRect
    3. drawTextBlob
    4. drawRRect
    5. drawCircle and etc.

* Parameters in Paint: Command Logs
    1. stokeMiter: determining how to paint the turning corner of a line (or called stroke join). See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit.
    2. strokeCap: determining how to paint both end of a line. See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap.

#### In-Paint Overlap VS. Cross-Paint Overlap

Take https://www.baidu.com as an example, once loading this page triggered paint events as follows:

| Index | Paint Area | In-Paint Overlap | Cross-Paint Overlap | Content Repetition |
| --- | --- | --- | --- | --- |
| 0 | 1021229 | 40191 (3.9%) | - | - |
| 1 | 1056112 | 75074 (7.1%) | 1021229 (96.7%) | - |
| 2 | 1067824 | 86786 (8.1%) | 1056112 (98.9%) | - |
| 3 | 1067824 | 86786 (8.1%) | 1067824 (100%) | - |
| 4 | 1067824 | 86786 (8.1%) | 1067824 (100%) | - |
| 5 | 1068112 | 87074 (8.2%) | 1067824 (99.9%) | - |

    In-Paint Overlap: measures how well a page is structured and implemented. Overlap requires browser to invalidate layers and declare new composite layer to normalize rendering process.

    Cross-Paint Overlap: measures how much area is changed with one paint. Better combine *Content Repetition*.

    Content Repetition: measures how much area is *meaninglessly* changed with one paint. 

**Paint Manner**:

https://www.baidu.com, https://www.qq.com: in each paint event, (re)paint the whole page first, then paint all visible elements.

https://www.163.com: in most paint events, only update part of the page (and subset of all elements). 

### Highlights

* Introducing Browser's Role
* Data Source for Page Performance
* Finer Granularity (Millisecond to Microsecond)
* Definition of Performance Metric
* How Precise the New Metric Depicts Page Loading Process

### Loading Timepoints

1. **navigationStart**: the timestamp (in milisecond) when previous document's unload terminates.

2. **loadEventEnd**: the timestamp when load (whole page, including all dependent resources are loaded) event terminates.

3. **requestStart**, **responseEnd**: the timestamp for the start of request and end of response for the *main document*, probably emitting the time spent in parsing the response.

4. **domLoading**: the timestamp when the parser starts working, as when `Document.readyState` changes to `'loading'` and corresponding `readystatechange` event is thrown.

5. **domComplete**: the timestamp when the parser finished its work on the *main document*, as when `Document.readyState` changes to `'complete'`, and corresponding `readystatechange` event is thrown.

**Event Order**: `readystatechange[interactive]` -> `DOMContentLoaded` -> `readystatechange[complete]` -> `loadEventEnd` 

### Metrics

1. Speed Index

2. Time to Interactive

3. Input Latency

4. Total Blocking Time

5. Max Potential First Input Delay