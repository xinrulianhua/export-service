
const puppeteer = require('puppeteer');
const util = require('./util.js');
const fs = require('fs');
const dir = './appdata';
const merge = require('easy-pdf-merge');




const puppeteerParams = {
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
};

function export3(path, req, callback){  
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
 
    util.delFiles(dir);



    (async () => {
        const browser = await puppeteer.launch(puppeteerParams);
        const page = await browser.newPage();

        
        var pagesForMerge = [];

        for(var i = 0; i < req.pages.length; i++){
            var currentPage = req.pages[i];
            var vb = currentPage.vb;
            var header = req.options.header.replace('{current-page}', i + 1).replace('{total-pages}', req.pages.length);
            var footer = req.options.footer.replace('{current-page}', i + 1).replace('{total-pages}', req.pages.length);
            var marginTop = req.options.margin[0];
            var marginBottom = req.options.margin[2];
            var backgroundColor = currentPage.backgroundColor;
            if (backgroundColor == undefined){
                backgroundColor = '';
            }
    
            var content =  currentPage.html ? currentPage.html : req.content;
    
            var html = exportHtml(content, req.options, currentPage.innerSize.w, currentPage.innerSize.h);

            var htmlPath = util.pageHtmlPath(__dirname, dir, path.href);
    
            fs.writeFileSync(htmlPath.path, html);

            await page.goto(htmlPath.url, { waitUntil: 'networkidle2' });


            await page.evaluate((data) => {
                var svg = document.querySelector('svg');
                if (svg && data.vb){
                    svg.setAttribute("viewBox", data.vb);    
                }

                if (svg && svg.style.backgroundColor){                                      
                    document.documentElement.style.backgroundColor = svg.style.backgroundColor;
                }
                else{
                    document.documentElement.style.backgroundColor = '#fff';
                }

                if (data.backgroundColor){
                    document.documentElement.style.backgroundColor = data.backgroundColor;           
                }

                var bgheader = document.getElementById('bg-header');
                var bgfooter = document.getElementById('bg-footer');                
                bgheader.innerHTML = data.header;
                bgfooter.innerHTML = data.footer;
                bgheader.style.top = (data.marginTop - bgheader.offsetHeight - 7) + 'px';
                bgfooter.style.bottom = (data.marginBottom - bgfooter.offsetHeight - 7) + 'px';              
                
            }, {vb, header, footer, marginTop, marginBottom, backgroundColor});          


            if (req.options.ext == "pdf"){                
                var pagepath = util.pagePdfPath(__dirname, dir);
                pagesForMerge.push(pagepath);
                await page.pdf({
                    printBackground: true,
                    path: pagepath,
                    pageRanges: '1',
                    margin: {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0
                    },
                    width  : currentPage.size.w + 'px',
                    height :  currentPage.size.h + 'px'
                });  
            }
            else if (req.options.ext == "png") {
                await page.screenshot({
                    path: path.targetpath,
                    printBackground: true,
                    clip : {
                        x      : 0,
                        y      : 0,
                        width  : parseFloat(currentPage.size.w),
                        height :  parseFloat(currentPage.size.h)
                    },
                });  
            }
        };

        if (pagesForMerge.length > 1){
            merge(pagesForMerge, path.targetpath, function(err){
                if(err)
                    return console.log(err);
                        
                callback(); 
            });
        }
        else if (pagesForMerge.length == 1){
            fs.copyFile(pagesForMerge[0], path.targetpath, (err) => {
                if (err) throw err;
                callback(); 
            });
        }
        else{
            callback();
        } 

        browser.close();
    })(); 
}


function exportHtml(html, options, w, h){    
    var smargin = '';
    for(var j = 0; j < options.margin.length; j++){
        smargin += (options.margin[j] + 'px ');
    }
    return '<!DOCTYPE html><html style="margin:0;padding:0;"><head></head><body style="margin:0; padding:0;">'
        + '<div style="margin: ' + smargin  + ';overflow:hidden;width:' + w + 'px;height:' + (h) + 'px">'
        + '<div id="bg-header" style="color:#757575;position:absolute;left:' + options.margin[3] + 'px;"></div>'
        + html
        + '<div id="bg-footer" style="color:#757575;position:absolute;left:' + options.margin[3] + 'px;"></div>'
        +  '</div>' 
        + '<div style="position: fixed; top: -100000px; left: -100000px;">' +  options.header + options.footer + '</div>'
        + '</body></html>';
}


module.exports = export3;