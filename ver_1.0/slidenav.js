/*
ver 2.1.0 2019-02-26
    -added options.dir for holding pages in a subfolder
ver 2.0.0 2019-01-17
    -renamed file and class to slidenav/slideNav
    -Added slide() function, currently required to be called from new page

ver 1.4.0 2018-07-23
    -added custom CSS flag, which requires 100% styling by caller
ver 1.3.0 2018-07-19
    -added transient pages
ver 1.2.0 2018-07-13
    -added _loadDelay
ver 1.1.0 2018-07-12
    -forced undefined options into object so child page will not report undefined
ver 1.0.0 2018-07-11
    -jshint fixes
ver 0.1.2 2018-04-18
    -fixed page restore code formmating weirdness
ver 0.1.1
    -SNF-loading-parent had contradicting z-index's
*/

/*
TODO:
    
*/

/* Here is the CSS that is applied automatically if customCSS is not true.
Copy/Paste/Edit into your CSS to modify

<style> 
    html {
		box-sizing: border-box;
		} 
	*, *:before, *:after {
		box-sizing: inherit;
		} 
	body { 
		margin: 0px; 
		padding: 0px; 
		height: 100%; 
		overflow: hidden;
	} 
    .SNF-div {
		margin: 0px;
		padding: 0px; 
		height: 100%; 
		position: absolute; 
        transition: all ease-in-out 0.5s;
	}  
    .SNF-iframe {
		width: 100%;
		height: 100%;
	} 
    .SNF-loading-parent {
		display: none;
		position: fixed;
		padding-top: 100px; 
        left: 0;
		top: 0; 
		width: 100%; 
		height: 100%; 
		overflow: auto; 
		background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.125); 
		z-index: 1000;
	} 
    .SNF-loading-content {
		background-color: #fefefe; 
		margin: auto; 
		padding: 20px; 
		border: 1px solid #888; 
		width: 10em; 
        border-radius: 10px; 
		font-size: xx-large; 
		color: darkcyan; 
		font-family: Arial, Helvetica, sans-serif; 
		text-align: center; 
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
	} 
        
</style>
*/



var slideNav = function(src, options, _customCSS) {
    // Creates a framwork for moving back and forth through a series of web pages
    // as if they were one seamless application. Uses iframes.
    // options:
    //  dir: 'string' a subfolder for all of the pages

    var _self = this;
    var _dims = {}; //the dimensions of the window
    //var inTrans = false; //used to prevent a double-transition with double-click
    //var _pages = {}; //holds information about the loaded pages
    var _pageList = []; //holds the list of pages, current page is alwys top of the stack
    var _currentPage = null; //hold the pageID for the current page so it can be moved off screen
    var _loadDelay = 1; //to delay running the startup and restore functions to help smooth animation (default no real delay)
    //TODO: make _loadDelay customizable
    
    this.globals = {}; //this is a global object for sub-pages to store relevent information in

    //this is the template for adding a new page SNF stands for SlideNavFrame
    var _pageHTML = '<div id=@ID class="SNF-div" style="margin-left: @LEFT-MARGINpx">' +
        '<iframe id=@frameID src=@SRC class="SNF-iframe" frameborder="0"></iframe></div>';
    
    //this add the 'loading' div
    var _loadingHTML = '<div id="SNF-loading" class="SNF-loading-parent"><div class="SNF-loading-content"><p>Loading....</p></div></div>';
   

    //this is the template for adding the basic styles to the page
    var _pageStyle = '<style>' +
        'html {box-sizing: border-box;} *, *:before, *:after { box-sizing: inherit;}' + 
        '.SNF-div {margin: 0px; padding: 0px; height: 100%; position: absolute;' +
            'transition: all ease-in-out 0.5s;}' + // border: 3px solid red;}' +
        '.SNF-iframe {width: 100%; height: 100%;}' +
        '.SNF-loading-parent { display: none; position: fixed; padding-top: 100px;' +
            'left: 0;top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgb(0,0,0);'+
            'background-color: rgba(0,0,0,0.125); z-index: 1000;}' +
        '.SNF-loading-content {background-color: #fefefe; margin: auto; padding: 20px; border: 1px solid #888; width: 10em;' +
        'border-radius: 10px; font-size: xx-large; color: darkcyan; font-family: Arial, Helvetica, sans-serif; text-align: center;' +
        'box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);}' +
        'body {margin: 0px; padding: 0px; height: 100%; overflow: hidden;}' +
        '</style>';

    var _options = options;

    /**************************************************************************************/
    //Public functions
    /**************************************************************************************/
    this.addPage = function(src, options, isTransient) {
        /*
             Add a page
            -src: the address of the page to load
            -options: a dictionary to pass to the page to control what it displays (like a StudentID)
            -isTransient: if true tells the page to remove itself after use (technically before restore)
        */

        //always pass a valid object to the new page
        if (typeof options === 'undefined') { options = {}; }
        if (isTransient !== true) {  isTransient = false; } 

        showLoading(true);
        var id = Date.now();
        if (typeof options === 'undefined') { options = {}; }
        var page = {
            src:src, 
            options: options,  
            id:'page_' + Date.now(),
            frameID: 'frame_' + Date.now(),
            transient: isTransient
        };
        if (_options.dir) { page.src = _options.dir + '/' + page.src; }

        _pageList.push(page);
        
        
    
        //create the new page HTML from the templage and replace the vars
        var newPageHTML = _pageHTML.replace(/@ID/g, page.id);
        newPageHTML = newPageHTML.replace(/@frameID/g, page.frameID);
        newPageHTML = newPageHTML.replace(/@SRC/g, page.src);
        newPageHTML = newPageHTML.replace(/@LEFT-MARGIN/g, _dims.width);
            
        //add the new page to the main page
        $('body').append(newPageHTML);
        sizePage(page.id);
        $('#' + page.frameID).on('load', function() {
            //execute the startup functions
            startPage(page.frameID, page.options);
            
            /*
            //TODO: hide the page while waiting for the new page to load???
            showLoading(false);
            //hide the current page
            hidePageDown(_currentPage);
            //and set the new current page
            _currentPage = page.id;

            //move the new page in
            movePageIn(page.id);

            

            //hide the last page
            window.setTimeout(function() {
                if (_pageList.length > 1) {
                    cleanupPageDown(_pageList[_pageList.length-2].id);
                }
            }, 650);
            */
        });
        
        /*
        setTimeout(function() {
            movePageIn(page.id);
        }, 500);
        */
    };

    this.slide = function() {
        var page = _pageList[_pageList.length-1];
        showLoading(false);
        //hide the current page
        hidePageDown(_currentPage);
        //and set the new current page
        _currentPage = page.id;

        //move the new page in
        movePageIn(page.id);

        //hide the last page
        window.setTimeout(function() {
            if (_pageList.length > 1) {
                cleanupPageDown(_pageList[_pageList.length-2].id);
            }
        }, 650);
    };

    this.back = function(options) {
        /*
            Moves back one page via the pageList stack, removes the current page div
            from the html and the stack
        */

        //always pass a valid object to the prev page
        if (typeof options === 'undefined') { options = {}; }

        hidePageRight(_currentPage);
        removePage(_currentPage, 1000);
        
        //check the previous pages to see if they are transient
        var skipPage = true;
        while (skipPage) {
            //if the 2nd to last page is transient, remove it 
            if (_pageList[_pageList.length-2].transient) {
                removePage(_pageList[_pageList.length-2].id, 0); //remove from HTML
                _pageList.pop(); //remove from stack   
            } else {
                skipPage = false; //if it's not a transient page, break the while
            }
        }

        restorePage(options);

        _pageList.pop();

        _currentPage = _pageList[_pageList.length-1].id;
    };


    /**************************************************************************************/
    //Local Functions:
    /**************************************************************************************/
    
    function startPage(frame, options) {
        // @ts-ignore
        if (typeof document.getElementById(frame).contentWindow.startup === 'function') {
            setTimeout(function() {
                // @ts-ignore
                document.getElementById(frame).contentWindow.startup(options);  
            }, _loadDelay);
                  
        }
    }

    function showLoading(show) {
        if (show) {
            $('#' + 'SNF-loading').css({"display":"block"});
        } else {
            $('#' + 'SNF-loading').css({"display":"none"});
        }

    }

    function movePageIn(pageID) {
        var css = {
            "margin-left":0,
            "opacity": 1
        };
        setCSS(pageID, css);    
    }

    function getDims() {
        _dims.width = $(window).innerWidth();
        _dims.height = $(window).innerHeight();
   }

    function sizePage(pageID) {
        //this.getDims(); //not needed to run every time.
        var css = {
            'top': _dims.menuHeight,
            'width': _dims.width,
            'height': _dims.height
        };
        setCSS(pageID, css);
    }

    function setCSS(pageID, css) {
        $('#' + pageID).css(css);
    }

    function hidePageDown(pageID) {
        var css = {
            "margin-top": _dims.height,
            "opacity": "0.25"
        };
        setCSS(pageID, css);
    }

    function hidePageRight(pageID) {
        var css = {
            "margin-left": _dims.width,
            "opacity": 0.25
        };
        setCSS(pageID, css);
    }

    function restorePage(options) {
        var css = {  
            "opacity": "1",
            "display": "block"
        };
        var pageID = _pageList[_pageList.length-2].id;
        setCSS(pageID, css);
        
        window.setTimeout(function() {
            setCSS(pageID, {"margin-top": "0"});
        }, 1); 

        //run the restore() function of the child
        // @ts-ignore
        if (typeof document.getElementById(_pageList[_pageList.length-2].frameID).contentWindow.restore === 'function') {
            //we need to store a reference to the page because the _pageList will be modified before the timeout executes
            //we could also use _pageList.length-1, but storing the reference seems safer
            // @ts-ignore
            var doc = document.getElementById(_pageList[_pageList.length-2].frameID).contentWindow;
            setTimeout(function() {
                // @ts-ignore
                //document.getElementById(_pageList[_pageList.length-2].frameID).contentWindow.restore(options);
                doc.restore(options);
            }, _loadDelay);   
        }
        //document.getElementById(_pageList[_pageList.length-2].frameID).contentWindow.restore(options);    
    }

    function removePage(pageID, delay) {
        window.setTimeout(function() {
            $('#' + pageID).remove();
        }, delay);
        
    }

    function resizeCurrentPages() {
        getDims();
        
        for (var i=0; i<_pageList.length; i++) {
            sizePage(_pageList[i].id);
        }
    }

    function cleanupPageDown(page) {
        var css = {
            "display": "none"
        };
        setCSS(page, css);
    }

    function setup(src, options) {
        //function to setup the parent web page to support the slidenav.
        //adds divs and sets styles.
        //if (_options.dir) { src = _options.dir + '/' + src; }
        getDims();
        if (!_customCSS) {
            $('head').append(_pageStyle);
        }

        //add the loading div to the main page
        $('body').append(_loadingHTML);

        
        $(window).resize(function() {
            // @ts-ignore
            jwf.debounce(resizeCurrentPages(), 500);
        });
        
        _self.addPage(src, options); //basically put the function params into an object to pass to addPage
        getDims(); //run extra time to fix scrollbar issue
        sizePage(_pageList[0].id);
    }

    /**************************************************************************************/
    //init the SlideNav
    setup(src, options);
    /**************************************************************************************/









}; //END OF SLIDNAVFRAME