import { IncomingMessage, ServerResponse } from 'http';
import { parseRequest } from './_lib/parser';
import { getScreenshot } from './_lib/chromium';
import { getHtml } from './_lib/template';
import fetch from 'node-fetch';

const isDev = !process.env.AWS_REGION;
const isHtmlDebug = process.env.OG_HTML_DEBUG === '1';


export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        const parsedReq = parseRequest(req);
        const html = getHtml(parsedReq);
        const { fileType, mime, image } = parsedReq;

        let delay = 0;
        let cacheTime = 3153600;

        if( mime.indexOf('svg+xml') >= 0 && image ){
            const response = await fetch(image);
            const body = await response.text();
            const animationMatches = body.match(/[0-9]{1,5}(ms)/);

            if( animationMatches.length ){
                delay = Math.round(parseInt(animationMatches[0].replace('ms', '')) * 0.75);
                delay = delay <= 6000 ? delay : 6000; // max 6 seconds for free plan
                cacheTime = 86400;
            }
        }

        if (isHtmlDebug) {
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
            return;
        }
    
        const file = await getScreenshot(html, fileType, isDev, delay);
        res.statusCode = 200;
        res.setHeader('Content-Type', `image/${fileType}`);
        res.setHeader('Cache-Control', `public, immutable, no-transform, s-maxage=${cacheTime}, max-age=${cacheTime}`);
        res.end(file);
    } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>Internal Error</h1><p>Sorry, there was a problem</p>');
        console.error(e);
    }
}
