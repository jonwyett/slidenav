/*
ver 2.7.2 19-05-09
    -fixed issue where refreshfunctions didn't always run
ver 2.7.1 19-05-08
    -added showOptionsPanel
ver 2.6.1 19-03-29
    -added showLoading
    -added loadStep
ver 2.5.1 19-02-26
    -fixed image path names
ver 2.5.0 19-02-22
    -added showRefreshAnimation
ver 2.4.1 19-02-21
    -disabled export/print popup when in text view mode
ver 2.4.0 19-02-20
    -hard-coded html for refreshMsgID (so the refresh popup is now card based and unified)
ver 2.3.1 19-02-19
    -refreshing now emits even if there are no functions
    -added some error checking to showPopUp so if you call
     showPopup(false) it wont try to load the msgs
ver 2.3.0 19-02-13
    -moved defaults into card
    -added export/print popup
    -added export-text popup
    -added events:
        -export-print
        -export-text
        -export-spreadsheet
        -export-restore: return card to default view
ver 2.2.0 19-01-30
    -added click event for export/print
    -added emit: 'export/print'
ver 2.1.2 19-01-25
    -fixed option icon rotation to be img only, not parent div
ver 2.1.1 19-01-23
    -set title to "Export/Print"
ver 2.1.0 19-01-18
    -add setFooterContent
ver 2.0.0 19-01-17
    -removed several generic functions
    -added autoRefresh to prevent refresh on init()
    -refresh() will now fire both 'refreshed' and 'ready' on first run
ver 1.1.1 19-01-16
    -added title div to setTitle

ver 1.1.0 18-01-15
    -added emit 'refreshing'
    -added searchBox
*/

/*
TODO:
    -clean up refreshMsgID-hard code issue
*/


var card = {
    //_self: this, //local refrence to the object -UNNEEDED?
    
    //will be set to true after the card inits and refresh completes
    //allows the ready emitter to only happen after the first refresh instead of refresh emit
    ready: false, 

    cardState: 'clean', //the save state of the card, 'clean/dirty/saving'

    data: {}, //an object to hold information used on your card form

    optionsPanelVisible: false, //holds state of options panel

    //Client-side settings **************************************************
    frameMinWidth: 375, //the minimum width of the frame in px
    frameMinHeight: 667, //the minumim height of the frame in px (these drfaults are for iPhone 6/7/8)

    resizeTimeout: null, //a timeout var
    resizeDelay: 100, //time in millisecs to delay a resizepage
    
    imgBack: 'images/Back-Light.png', // the default back icon
    imgRefresh: 'images/Refresh2-Light.png', // the refresh icon
    imgOptions: 'images/Options-Light.png', // the options icon
    imgExport: 'images/Export-Light.png', // the delete options icon
    imgSave: 'images/Save-Light.png', //the save icon
    imgMenuMore: 'images/menu/MenuMore-Light.png', //path to menu more icon

    imgExportPrint: 'images/Print_Light.png', //icon to print
    imgExportText: 'images/Text_Light.png', //icon for view text
    imgExportSpreadsheet: 'images/spreadsheet_light.png', //icon for export to spreadsheet

    showExportPrint: false, //show the option to print
    showExportText: false, //show the option to view text
    showExportSpreadsheet: false, //show the option to export to a spreadsheet
    exportCopyParent: 'card-page-content', //the div that hold the export-text content

    exportPrintHTML: null, //this will hold the export/print html


    showBack: true, //show the back button
    showOptions: false, //show the options button
    showRefresh: false, //show the refresh button
    showExport: false, //show the export button

    refreshBarID: 'refresh', //the name given in the html template for the progress bar
    refreshInfoID: '#refresh-progressbar-info', //the name of the div given in the HTML for the info 
    refreshMsgID: '#refresh-template-msg', //the id where the refresh msg goes, given in the html
    refreshPopupWidth: '22rem', //width of the refresh popup
    refreshBarParentID: 'refresh-progressbar-parent', //name of the progress bar parent div

    optionsPanelWidth: 352, //the width of the options panel TODO: should this be in px?

    cardPageStatic: false, //if set to true the card-page element will be set to the same size as the frame

    autoRefresh: true, //should the init() function automatically run the refresh routine? DEFUALT=true

    /**********************************************************************/
    
    disableExportPrintPopup: false, //so you can't click export-print while in text view
    refreshFunctions: [], //an array holding the functions to be refreshed
    
    state: function(state) {
        //used to set and read the state of the card 'clean/dirty/saving'
        if (typeof state === 'string') {
            if (state === 'clean' || state === 'dirty' || state === 'saving') {
                this.cardState = state;
                if (state === 'dirty') {
                    $('#img_Back').attr('src', this.imgSave);
                    $('#img_Back').removeClass('spinner');
                    this.setConfirmUnload(true);  
                } else if (state === 'clean') {
                    $('#img_Back').attr('src', this.imgBack);   
                    $('#img_Back').removeClass('spinner');   
                    this.setConfirmUnload(false); 
                } else if (state === 'saving') {
                    $('#img_Back').attr('src', this.imgSave);
                    $('#img_Back').addClass('spinner');
                }
            }
        }
        return this.cardState;
    },

    refresh: function() {
        var _self = this;
        
        _self.emit('refreshing');
        
        function refreshComplete() {
            $('#img_Refresh').removeClass('spinner');
            _self.showPopup(false);
            _self.emit('refreshed');
            if (!_self.ready) { //i.e. we're not ready yet, but will be after this
            _self.emit('ready');
                _self.ready = true;
            }     
        }
        function checkComplete() {
            var allComplete = true;
            _self.refreshFunctions.forEach(function(func) {
                if (!func.complete) { allComplete = false; }
            });
            if (allComplete) {  
                //_self.showPopup(false);
                refreshComplete();    
            } 
        }

        if (this.refreshFunctions.length === 0) { 
            refreshComplete();
            return; //to stop further procesing
        } 

        $('#img_Refresh').addClass('spinner'); 

        this.showPopup(true, 'Loading...', 'refresh', '', this.refreshPopupWidth);
        var totalSteps = _self.refreshFunctions.length + 1; //the total steps in the bar
        this.addProgressbar(this.refreshBarID, this.refreshBarParentID, totalSteps, true);
        //auto increment to start the bar:
        _self.progressbar(_self.refreshBarID, 'step');
        $(_self.refreshInfoID).html('Initializing...');
        

        _self.refreshFunctions.forEach(function(func) {
            func.complete = false;
            func.cmd(function() {
                func.complete = true;
                _self.progressbar(_self.refreshBarID, 'step');
                $(_self.refreshInfoID).html(func.caption);
                checkComplete();                
            });
        });
    },

    addRefreshFunction: function(cmd, caption) {
        this.refreshFunctions.push({
            cmd: cmd,
            caption: caption,
            complete: false
        });
    },

    showLoading: function(show, count, caption) {
        //let's a user create a loading dialog
        //  -show: bool, if false the loading dialog will close
        //  -count: num, the number of steps in the progressbar
        //  -caption: string, this is the first 'fake' loading element so the progressbar shows something
        var _self = this;
        
        this.showPopup(show, 'Loading...', 'refresh', '', this.refreshPopupWidth);
        
        this.addProgressbar(this.refreshBarID, this.refreshBarParentID, count+1, true);
        $(_self.refreshInfoID).html(caption);
        _self.progressbar(_self.refreshBarID, 'step');
    },

    loadStep: function(caption) {
        //increments the loading dialog
        //  -caption: string, the new caption to show
        var _self = this;
        _self.progressbar(_self.refreshBarID, 'step');
        $(_self.refreshInfoID).html(caption);
    },


    resizeFrame: function() {
        //resizes the card frame to be full screen
        //also prevents the frame from being smaller then min widths/heights
        var win = {};
        //win.width = $(window).innerWidth();
        win.width = $(window).outerWidth();
        win.height = $(window).innerHeight();

        win.pageWidth = win.width > this.frameMinWidth? win.width : this.frameMinWidth;
        win.pageHeight = win.height > this.frameMinHeight? win.height : this.frameMinHeight;
        $('#card-frame').height(win.pageHeight);
        $('#card-frame').width(win.pageWidth);
        if (this.cardPageStatic) {
            $('#card-page').css({
                height: $('#page-frame').innerHeight(),
               width: $('#page-frame').innerWidth()
            });
   
        }

        if (this.showOptions) { this.drawOptionsPanel(); }

        if (this.showExport) {
            $('#exit-export-print-parent').css({"left":0}); //this keeps the frame from resizing
            var closePos = win.width;
            closePos -= $('#exit-export-print-parent').width();
            closePos -= 48;
            $('#exit-export-print-parent').css({"left":closePos});
        }

        this.emit('resize');
    },
    

    /*******************   Custom Emitter Code  **************************************************/
    events: {},
    on: function(event, callback) {
        //attaches a callback function to an event
        this.events[event] = callback;    
    },
    emit: function(event, payload) {
        //emits an event
        /*
            -event: the name of the event and the string to bind with on the client side
            -payload: the primary thing to send to the client
        */
        if (typeof this.events[event] === 'function') { //the client has registered the event
            this.events[event](payload);
        } else if (typeof this.events.other === 'function') { //the event is unregistered and the client has asked for other
            this.events.other(payload, event);    
        }
        //the client wants all events in this callback
        if  (typeof this.events.all === 'function') {
            this.events.all(payload, event);
        }    
    },

    //this is a public function that is run by the export-print popup so that only emitters are used to communicate with the page
    exportPrint: function(type) {
        //all the emits are individually enumerated to allow granular configs
        if (type === 'close') {
            this.showPopup(false);
        } else if(type === 'export-print') {
            this.showPopup(false);
            this.emit(type);
        } else if(type === 'export-text') {
            this.disableExportPrintPopup = true;
            this.showPopup(false);
            $('#exit-export-print-parent').show();    
            this.emit(type);       
        } else if(type === 'export-spreadsheet') {
            this.showPopup(false);
            this.emit(type);    
        } else if (type === 'restore') {
            this.disableExportPrintPopup = false;
            $('#exit-export-print-parent').hide();
            this.emit('export-restore');    
        }  else if (type === 'copy') {
            if(this.exportCopyParent) {
                jwf.copyText(this.exportCopyParent, 500);
            }
        } else {
            this.emit(type);
        }
    },

    /******************************************************************************/

    userTemplates: {}, //the first time you call an error/popup/progressbar/etc it removes the 
    //content from the page and stores it inside this object as a string. On further calls it 
    //uses the stored version. This helps prevent id collisions and you can feel confident that
    //only one copy of the structure is ever on the page at one time.

    /**********************************************************************************************/
    /**********************************************************************************************/
    /**********************************************************************************************/
    
    setTitle: function(title) {
        //adds a title to header
        var titleHTML = '<div id="header-title">' + title + '</div>';
        $('#header-content').html(titleHTML);
    },

    setFooterContent: function(content) {
        //adds content to the footer
        $('#footer-content').html(content);
    },
    
    getLayout: function(layout) {
        /*  Returns a string value to be used as HTML layout
            will either return the contents of a div using the #id style or
            will return the same string that was passed
                -layout: the #id or string
        */
        if (layout.substring(0,1) === '#') {
            //loads the content of the message via the id supplied
            var id = layout.substring(1,layout.length); //so this is #layout --> layout
            if (typeof this.userTemplates[id] === 'undefined') {
                this.userTemplates[id] = $(layout).html();
                $(layout).remove();
            }
            return this.userTemplates[id];
        } else {
            return layout; //pass back the original layout string
        }

    },

    showError: function(show, title, message, options, width, replacementStrings) {
        //this is the basic template for showing the error 
        /*
            -show: true/false
            -title: a title
            -message: the #id of a parent div holding the message or a string
            -options: the #id of a parent div holding the options or a string
            -width: a CSS string
            -replacementString: an object of replacement strings:
                {
                    '@msg': 'Hello World',
                    '@notice': 'Foo Bar
                } 
        */
       
       if (typeof width === 'undefined') { width="90%"; }

        var template = '<div class="error-parent" id="@id">' +
            '<div class="error-content" style="width: @width">' +
            '<div class="error-title"><p><b>@title</b></p></div>' +
            '<div class="error-msg">@message</div>' +
            '<div class="error-options">@options</div></div></div>';
        var messageTemplate = "";
        var optionsTemplate = "";
        var id = 'error_card_ShowError'; //creates a unique id //TODO add timestamp to ID

        function showError(showIt) {
            //shows or hides the error
            template = template.replace('@id', id); 
            template = template.replace('@width', width);
            template = template.replace('@title', title);
            template = template.replace('@message', messageTemplate);
            template = template.replace('@options', optionsTemplate);

            //now do custom string replacements
            if (replacementStrings) {
                Object.keys(replacementStrings).forEach(function(key) {
                    template = template.replace(key, replacementStrings[key]);    
                });
            }
            
            if (showIt) {
                $(document.body).append(template);
            } else {
                $('#' + id).remove();
            }
        }

        if ($('#' + id).length) { //check if the error allready exists
            if (!show) {
                showError(false);
            }
        } else {
            messageTemplate = this.getLayout(message);
            optionsTemplate = this.getLayout(options);
            showError(show);
        }
    },

    showPopup: function(show, title, message, options, width, replacementStrings) {
        //this is the basic template for showing a model popup 
        /*
            -show: true/false
            -title: a title
            -message: the id of a parent div holding the message
            -options: the id of a parent div holding the options
            -width: a CSS string 
            -replacementStrings: an object of replacement strings:
                {
                    '@msg': 'Hello World',
                    '@notice': 'Foo Bar
                } 
        */
        var _self = this;
        if (typeof width === 'undefined') { width="90%"; }
    
        var template = '<div class="popup-parent" id="@id">' +
                '<div class="popup-content" style="width: @width">' +
                '<div class="popup-title"><p><b>@title</b></p></div>' +
                '<div class="popup-msg">@message</div>';
        var templateOptionsSection = '<div class="popup-options">@options</div></div></div>';
        var messageTemplate = "";
        var optionsTemplate = "";
        var id = 'popup_card_ShowPopup'; //creates a unique id //TODO: add a timestamp to the id
        
        function showPopup(showIt) {
            //shows or hides the error
            template = template.replace('@id', id); 
            template = template.replace('@width', width);
            template = template.replace('@title', title);
            template = template.replace('@message', messageTemplate);
            //check to see if there's an options (buttons) section and only add in that case
            if (optionsTemplate) {
                template += templateOptionsSection;
                template = template.replace('@options', optionsTemplate);
            }

            //now do custom string replacements
            if (replacementStrings) {
                Object.keys(replacementStrings).forEach(function(key) {
                    template = template.replace(key, replacementStrings[key]);    
                });
            }
                
            if (showIt) {
                $(document.body).append(template);
            } else {
                $('#' + id).remove();
            }
        }
    
        if ($('#' + id).length) { //check if the error allready exists
            if (!show) {
                showPopup(false);
            }
        } else {
            if (show) { //TODO clean up, should this be hardcoded for refresh?
                if (message === 'refresh') {
                    messageTemplate = '<div id="refresh-progressbar-parent" style="width:100%; height:2rem;"></div>' +
                                '<div id="refresh-progressbar-info" class="progressbar-info"></div>';
                } else {
                    messageTemplate = _self.getLayout(message);
                }
                optionsTemplate = _self.getLayout(options);
            } 
            showPopup(show);
        }
    },

    headerMenu: function(items) {
        /* Creates the header menu.

            -items:
            [
                {
                    title: 'Menu Item',
                    icon: 'icon.png',
                    cmd: "myFunction('param')"
                }
            ]

            Use:
            var myMenu = new headerMenu([{}]);
            fuction myFunction(value) {
                //do something using passed value
            }

        */ 

        var _self = this;
        var avialableWidth = 0;
        var neededWidth = 0;
        var menuHeight = 0;
        var menuItems = [];
        var showOverflow = false;
        var resizeTimeout;
        
        var moreButton = {
            visible: false,
            id: 'menu-item-more',
            width: 0,
            html:
                '<div class="header-menu-item header-menu-alt" id="menu-item-more">' +
                    '<div class="header-menu-item-top"></div>' +
                    '<div class="header-menu-item-content">' +
                        '<div class="header-menu-title">More</div> ' +
                        '<div class="header-menu-icon" id="more-icon" style="transition-duration: 0.5s">' +
                            '<img src="' + card.imgMenuMore + '" >'+ //TODO: make this a general ref like this/_self
                        '</div>' +
                    '</div>' +
                    '<div class="header-menu-item-bottom"></div>' +
                '</div>'  
        };

        (function startup(){
            //create the menu background
            $('#header-content').append('<div id="header-menu-background"></div>');
            
            //get the height of the menu
            var i;
            menuHeight = $('#header-frame').outerHeight(true);
            var calcMenuHTML = '<div id="calc-menu" style="position:fixed">';
            calcMenuHTML += '<div style="position: fixed">' + moreButton.html + '</div>';
            
            //create the calc-menu
            for (i=0; i<items.length; i++) {
                var tempHTML = 
                    '<div class="header-menu-item" id="@id" onclick="@cmd">' +
                        '<div class="header-menu-item-top"></div>' +
                        '<div class="header-menu-item-content">' +
                            '<div class="header-menu-icon"><img src="images/menu/@icon"></div>' +
                            '<div class="header-menu-title">@title</div>' +
                        '</div>' +
                    '<div class="header-menu-item-bottom"></div>' +
                    '</div> ';

                tempHTML = tempHTML.replace(/@id/g, 'menu-item-' + i);
                tempHTML = tempHTML.replace(/@title/g, items[i].title);
                tempHTML = tempHTML.replace(/@icon/g, items[i].icon);
                tempHTML = tempHTML.replace(/@cmd/g, items[i].cmd); 
                calcMenuHTML += '<div style="position: fixed">' + tempHTML + '</div>';
                //add the menu item into the array
                menuItems.push({
                    id: 'menu-item-' + i,
                    width: 0,
                    html: tempHTML
                });
            }
            calcMenuHTML += '</div>';
            
            //add the calc menu to the body
            $('body').append(calcMenuHTML);
            //calculate the widths
            moreButton.width = Math.ceil($('#' + moreButton.id).outerWidth(true));
            for (i=0; i<menuItems.length; i++) {
                menuItems[i].width = Math.ceil($('#' + menuItems[i].id).outerWidth(true));
                //add into the needed width for full menu
                neededWidth += menuItems[i].width; 
            }
            
            //remove the calc-menu
            $('#calc-menu').remove();

            //add the overflow menu
            $('body').append('<div id="overflow-menu" class="header-overflow-menu"></div>');
          
            //set a handler to redraw the menu
            $(window).on('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    draw();
                }, 300);    
            });

            //set a handler to hide the menu when something else is clicked
            $(window).on('click', function(event) {
                if (!event.target.closest('#' + moreButton.id)) {
                    _self.visible(false);
                }
            });

            //now draw the menu
            //setTimeout(function() {
                draw();
            //}, 2000);
              
        }());

        //this.draw = function() {
        function draw() {
            var menuHTML = '';
            var overflowHTML = '';
            avialableWidth = $('#header-menu-background').width();
            if (neededWidth <= avialableWidth) {
                moreButton.visible = false;
                menuItems.forEach(function(item) {
                    menuHTML += item.html;
                });
            } else {
                moreButton.visible = true;
                var runningTotal = moreButton.width;
                for (var i=0; i<menuItems.length; i++) {
                    runningTotal += menuItems[i].width;
                    if (runningTotal < avialableWidth) {
                        menuHTML += menuItems[i].html;
                    } else {
                        overflowHTML += menuItems[i].html;
                    }   
                }
                menuHTML += moreButton.html;
            }
            
            $('#header-menu-background').html(menuHTML);
            $('#overflow-menu').html(overflowHTML);
            
            if (moreButton.visible) {
                //set the left position of the overflow menu
                if ($('#' + moreButton.id).position().left + $('#overflow-menu').outerWidth(true) > $('#header-menu').outerWidth(true)) {
                    //the overflow menu would reach beyond the screen
                    var newLeft = $('#header-menu').outerWidth(true) - $('#overflow-menu').outerWidth(true);
                    $('#overflow-menu').css({left: newLeft});
                } else {
                    $('#overflow-menu').css({left: $('#' + moreButton.id).position().left});
                }

                //set the top position of the overflow menu
                if (!showOverflow) { //only if it's hidden
                    var newTop = menuHeight - $('#overflow-menu').outerHeight(true);
                    $('#overflow-menu').css({top: newTop});
                    //$('#overflow-menu').hide();
                }
            }
            
            //if the more button is visible then add the onclick event
            if (moreButton.visible === true) {
                $('#' + moreButton.id).off('click'); //clear any exiting handler
                $('#' + moreButton.id).on('click', function() {
                    //execute visible() with opposite of exiting visibility
                    _self.visible(!showOverflow);     
                });    
            }
        }

        this.visible = function(isVisible) {
            if (typeof isVisible !== 'undefined') {
                showOverflow = isVisible; 
                var hideTop = menuHeight - $('#overflow-menu').outerHeight(true);
                    
                if (showOverflow) {
                    $('#overflow-menu').show();
                    $('#overflow-menu').css({top: menuHeight});
                    $('#more-icon').css({transform: 'rotate(-180deg)'});
                    $('#overflow-menu').addClass('shadow');
                } else {
                    $('#overflow-menu').css({top: hideTop}); 
                    $('#more-icon').css({transform: 'rotate(0deg)'});
                    $('#overflow-menu').removeClass('shadow');
                    setTimeout(function() {
                        //$('#overflow-menu').hide();
                    }, 500);
                }
            }
            return showOverflow;
        };
    }, 

    createOptionsPanel: function() {
        //creates the options panel
        var panelHTML = '<div id="options-panel"></div>';
        $('body').append(panelHTML);
        $('#options-panel').hide();
    },

    drawOptionsPanel: function(switchState) {
        //draws the options panel
                
        if (switchState) {
            if (this.optionsPanelVisible) {
                this.optionsPanelVisible = false;
                $('#img_Options').css({transform: 'rotate(0deg)'});
                setTimeout(function() {
                    $('#options-panel').hide();
                },750);
            } else {
                this.optionsPanelVisible = true;
                $('#img_Options').css({transform: 'rotate(90deg)'});
                $('#options-panel').show();
            }
        }
        
        var panelDims = this.getOptionsPanelDims(this.optionsPanelVisible);
        $('#options-panel').css({
            top: panelDims.top,
            width: panelDims.width,
            height: panelDims.height,
            left: panelDims.left
        });

        $('.options-item').each(function(index, element) {
           $(this).appendTo('#options-panel');    
        });

    },

    showOptionsPanel: function(show) {
        //Shows or hides the options panel
        //meant to be called by page to manually set the state

        //pretty simple, just switch the state if the current state doesn't match the requested state
        //if it matches, do nothing.
        if (this.optionsPanelVisible !== show) {
            this.drawOptionsPanel(true); //true=switch state
        }
    },

    getOptionsPanelDims: function(visible) {
        var windowHeight = $(window).innerHeight();
        var windowWidth = $(window).outerWidth();
        var headerHeight = $('#header-frame').innerHeight();
        var footerHeight = $('#footer-frame').innerHeight();
        var pageHeight =  windowHeight - headerHeight - footerHeight;
        
        var topOffset = this.rem2px(0);
        var bottomOffset = this.rem2px(2);

        var topPos = headerHeight + topOffset;
        var panelHeight = pageHeight-topOffset-bottomOffset;

        var leftPos = 0; 

        if (visible) {
            leftPos = windowWidth - this.optionsPanelWidth;    
        } else {
            leftPos = windowWidth + this.rem2px(1);           
        }

        return {
            left: leftPos,
            top: topPos,
            height: panelHeight,
            width: this.optionsPanelWidth
        };
    },

    rem2px: function(rems) {
        //converts rem units to px and returns
        var html = document.getElementsByTagName('html')[0];
        return parseInt(window.getComputedStyle(html).fontSize) * rems;        
    },

    progressbars: {
    },

    addProgressbar: function(name, parent, steps, showPercent) {
        if (typeof showPercent === 'undefined') { showPercent = false; }
        this.progressbars[name] = {
            steps: steps, 
            currentStep: 0, 
            width: $('#' + parent).width(), 
            showPercent: showPercent     
        };
        
        var template = '<div class="progressbar-back" id="progressbar-back_' + name + '">' +
            '<div class="progressbar" id="progressbar_' + name + '"></div></div>';
        
        $('#' + parent).html(template); 
        this.progressbar(name, 'setstep', 0);
    },

    progressbar: function(name, action, value) {
        /*
        name: the name of the bar
        action: the action to perform
            -step - add one step to the bar
            -setstep - set a particular step value
            -text - set the text
            -remove - removes a progress bar NOTE: not needed if part of a popup
        value: the value for the action. Ex: progressBar('test','setStep',5)
        */
        var bar = this.progressbars[name];
        if (action.toLowerCase() === 'step') {
            bar.currentStep ++;
            if (bar.currentStep > bar.steps) {bar.currentStep = bar.steps; } //don't go beyond max

            $('#progressbar_' + name).width(bar.currentStep * (bar.width/bar.steps));
            if (bar.showPercent) {
                $('#progressbar_' + name).html(Math.round((bar.currentStep/bar.steps)*100) + '%');    
            }
        } else if(action.toLowerCase() === 'setstep') {
            bar.currentStep = value;
            $('#progressbar_' + name).width(bar.currentStep * (bar.width/bar.steps));
            if (bar.showPercent) {
                $('#progressbar_' + name).html(Math.round((bar.currentStep/bar.steps)*100) + '%');
            }
        } else if(action.toLowerCase() === 'text') {
            if (!bar.showPercent) {
                $('#progressbar_' + name).html(value);
            }
        } else if(action.toLowerCase() === 'remove') {
            $('#progressbar-back_' + name).remove();
        }
    },

    moveContent: function(elem, to, isParent) {
        /*  Moves the contents from one div to another, useful when you need to move controls
            during a screen resize
                -elem: the div with the content
                -to: the div you want the content moved to
                -isParent: default=false: the elem will not be treated as the parend and the
                    full elem will be moved. If set to true then the elem will be considered
                    the parent and only it's innerHTML will be moved.
        */
        //strip the leading '#' since this will always be based on an ID
        if (elem.substring(0,1) === '#') { elem = elem.substring(1,elem.length); }
        if (to.substring(0,1) === '#') { to = to.substring(1,to.length); }
        var content = '';
        if (isParent) {
            content = $('#' + elem).html();
            $('#' + elem).empty();
        } else {
            content = $('#' + elem).parent().html();
            $('#' + elem).parent().empty();
        }
        
        $('#' + to).append(content);
    },

    showRefreshAnimation: function(spin) {
        //manually spin the refresh icon
        //  -show: bool, spin?

        if (spin) {
            $('#img_Refresh').addClass('spinner');
        } else {
            $('#img_Refresh').removeClass('spinner');
        }
    },


    setConfirmUnload: function (on) {
        window.onbeforeunload = on ? this.unloadMessage : null;
    },

    unloadMessage: function() {
        return ('You have entered new data on this page. ' +
                'If you navigate away from this page without ' +
                'first saving your data, the changes will be lost.');
    },

 
    /*******************   Initializes the card  **************************************************/
    init: function(options) {
        var _self = this; //keep the card context when the context switches
        
        var baseHTML = 
        '<div id="card-frame">' +
                '<div id="header-frame"> ' +
                    '<div id="header-content"></div> ' +  
                '</div>' +
                '<div id="page-frame"></div>' +
                '<div id="footer-frame">' +
                    '<div id="footer-content"></div> ' + 
                '</div>' +
            '</div>';

        var backHTML = '<div id="header-back" title="Back"></div>';
        var backButtonHTML = '<img src="@imgBack" id="img_Back">';
        var optionsHTML = '<div id="header-options" title="Options"></div>';
        var optionsButtonHTML = '<img src="@imgOptions" id="img_Options">';
        var refreshHTML = '<div id="footer-refresh" title="Refresh"></div>';
        var refreshButtonHTML = '<img src="@imgRefresh" id="img_Refresh">';
        var exportHTML = '<div id="footer-export" title="Export/Print"></div>';
        var exportButtonHTML = '<img src="@imgExport" id="img_Export">';

        //insert the basic card layout
        $('body').append(baseHTML);

        //insert buttons as applicable
        if (this.showBack) {
            $('#header-content').before(backHTML);
            $('#header-back').append(backButtonHTML.replace('@imgBack', this.imgBack));
        }
        if (this.showOptions) {
            $('#header-content').after(optionsHTML);
            $('#header-options').append(optionsButtonHTML.replace('@imgOptions', this.imgOptions));
            this.createOptionsPanel();
        }
        if (this.showRefresh) {
            $('#footer-content').before(refreshHTML);
            $('#footer-refresh').append(refreshButtonHTML.replace('@imgRefresh', this.imgRefresh));
        }
        if (this.showExport) {
            $('#footer-content').after(exportHTML);
            $('#footer-export').append(exportButtonHTML.replace('@imgExport', this.imgExport));
        }

        //move the page content into the card frame and unhide it
        $('#card-page').appendTo('#page-frame');
        $('#card-page').css({display: 'block'});

        //attach the resize handler
        $(window).on('resize', function() {
            clearTimeout(_self.resizeTimeout);
            _self.resizeTimeout = setTimeout(function() {
                _self.resizeFrame();
            }, _self.resizeDelay);
        });

        if (this.showBack) {
            $('#header-back').click(function() {
                if (_self.cardState === 'clean') {
                    _self.emit('back');
                } else if (_self.cardState === 'dirty') {
                    _self.emit('save');
                }
            });
        }
            
        if (this.showRefresh) {
            $('#footer-refresh').click(function() {
                _self.refresh();
            });
        }

        if (this.showOptions) {
            $('#header-options').click(function() {
                _self.drawOptionsPanel(true);
            });
        }

        if (this.showExport) {
            $('#footer-export').click(function() {
                if (!_self.disableExportPrintPopup) { 
                    _self.showPopup(true, 'Export/Print', '', _self.exportPrintHTML, '18em');
                }
            });
        }

        /*------------------------------- Create the Export/Print popup -------------------------*/

        if (this.showExport) {
            var html = ''; //for code brevity

            html = '<div id="export-print-options"><div class="export-print-grid"><div class="export-print-background">';

            if (this.showExportPrint) {
                html += '<div class="export-print-item" ' +
                            'id="export-print" '+
                            'onclick="card.exportPrint(' + "'export-print'" + ')">' +
                            '<img src="' + this.imgExportPrint + '">' +
                            '<div class="export-print-item-title">Print</div>' +
                        '</div>';
            }

            if (this.showExportText) {
                html += '<div class="export-print-item" ' +
                            'id="export-text" ' +
                            'onclick="card.exportPrint(' + "'export-text'" + ')">' +          
                            '<img src="' + this.imgExportText + '">' +
                            '<div class="export-print-item-title">Text</div>' +
                        '</div>';
            }

            if (this.showExportSpreadsheet) {
                html += '<div class="export-print-item" ' +
                            'id="export-excel" ' +
                            'onclick="card.exportPrint(' + "'export-spreadsheet'" + ')">' +          
                            '<img src="' + this.imgExportSpreadsheet + '">' +
                            '<div class="export-print-item-title">Excel</div>' +
                        '</div>';
            }

            html += '</div><button type="button" id="cmd_ExportPrintCancel" ' +
                    'onclick="card.exportPrint(' + "'close'" + ')">' +                
                    'Cancel</button></div></div>';
            
            this.exportPrintHTML = html;

            /****************************** CREATE THE CLOSE DIALOG ******************************/
            html = '<div id="exit-export-print-parent" style="display:none">' +
                        '<button id="cmd_ExportCopyText" ' +
                            'onclick="card.exportPrint(' + "'copy'" + ')">Copy Text</button><br>' +
                        '<button id="cmd_ExitExportPrint" '+
                            'onclick="card.exportPrint(' + "'restore'" + ')">Close Export/Print View</button>' +
                    '</div>';

            $('body').append(html);
        }



        //finally resize and refresh the card
        this.resizeFrame();
        if (this.autoRefresh === true) { this.refresh(); }
    },
};

