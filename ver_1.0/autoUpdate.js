/*
ver 2.3.0 2019-03-08
    -add public saveField call
ver 2.2.0 2018-07-27
    -support for checkboxes
ver 2.1.2 2018-07-06
    -moved logic from onchange to savfield
ver 2.1.1 2018-07-05
    -fixed bug when getting fieldname attribute
ver 2.1.0 2018-06-26
    -added _AutoDisable
    -added passing back a failed update state
    -added save()
    -allow for mixed-case fieldName attribute in html
ver 2.0.1 2018-06-25
    -changed state class suffix from -modified to -dirty to match internal state names
ver 2.0.0 2018-06-25
    -complete re-write
*/

/*
TODO:
    -Better check for fieldname attribute so all capitilizations are captured    
*/

function autoUpdate(_ClassName, _UpdateFunction, _AutoDisable, _Validation, _Formatting) {
    /*
        This class sets up various inputs to be auto-updating/saving, similar to how you might bind a control
        in .NET
            _ClassName (REQUIRED): the class of the controls you wish to apply this to
            _UpdateFunction: a callback that executes when the assigned control has changed and loses focus
                The intent is that this callback will do the actually updating of the data to your specifications
            _AutoDisable: controls that are in a saving state will be disabled: default=true
            _Validation: an object of user-supplied validation functions if it returns false the record wont be saved
                EX: {
                    firstName: function(val) {
                        if (val === '') {
                            return false;
                        } else {
                            return true;
                        }
                    }
                }
            _Formatting: a formatting function that will be run before the record is saved
                EX: {
                    phoneNumber: function(val) {
                        return val.replace(/\D/g, ''); //removes non-digits from phone numbers
                    }
                }
                    
        This class doesn't actually do any updating/saving, it is only a wrapper
        
        Classes will be added to the controls when their state changes so you can change their appearance:
            <_ClassName>-dirty: for when a field has been modified
            <_ClassName>-saving: While the callback is running
            <_ClassName>-saved: The field is successfully saved (when the callback returns true)

        There are 3 states for each control:
            1. clean: the control is saved, or at the initial value
            2. dirty: the control has been modified from its original value
            3. saving: the control is saving the new value
        These 3 states also apply to the class as a whole, where in order:
            -If anything is saving then the state is saving
            -If nothing is saving but something is dirty then it is dirty
            -If nothing is saving and nothing is dirty then it is clean

        The class also passes events through an emitter
        Use:
            autoUpdate.on('eventName', function(payload, options){}): bind to a specific event
            autoUpdate.on('all', function(payload, options, eventname){}): all events
            autoUpdate.on('other', function(payload, options, eventName){}): any event that you haven't bound
        Events:
            'state': whenever any control's state changes   
                -payload: the fieldName
                -options: the _Fields object

        Public Functions:
            on(EventName, Callback): binds an event
            state(): returns the current state of the class
            save(): tries to save all dirty fields
            fields(): returns a copy of the _Fields object:
                _Fields: {
                    elementID: {
                        fieldName: 'the database field to save to',
                        oldValue: 'the value the control had when it got focus',
                        newValue: 'the current value of the control'
                        state: 'clean/dirty/saving',
                        emittedDirty: true/false //to prevent extra emits when typing
                    }
                }

        minimal use:
        <script>
            myAU = new autoUpdate('myClass', function(fieldName, oldValue, newValue, callback) {
                saveTheDataAsync(fieldName, newValue, function() {
                    callback();
                });
            });
        </script>
        <html>
            <input type="text" id="text-org" class="myClass" fieldname="Organization">
        </html>

        Note that id, class and fieldName are all required
   
    */

    var _Events = {}; //use for eventemitter
    var _Fields = {}; //this holds information about the various fields.
    if (typeof _ClassName === 'undefined') { return false; }
    if (typeof _AutoDisable === 'undefined') { _AutoDisable = true; }
    if (typeof _Validation === 'undefined') { _Validation = {}; }
    if (typeof _Formatting === 'undefined') { _Formatting = {}; }

    /*
    function debug(msg) {
        //window.alert(msg);
        //jwf.debug(msg);
    }
    */

    function emit(EventName, Payload, Options) {
        //emits an event
        /*
            -EventName: the name of the event and the string to bind with on the client side
            -Payload: the primary thing to send to the client
            -Options: the secondary thing to send to the client
        */
        //payload/options are just placeholders, they can be anything.
        if (typeof _Events[EventName] === 'function') { //the client has registered the event
            _Events[EventName](Payload, Options, EventName);
        //the event is unregistered and the client has asked for other
        } else if (typeof _Events.other === 'function') { 
            _Events.other(Payload, Options, EventName);    
        }
        //the client wants all events in this callback
        if  (typeof _Events.all=== 'function') {
            _Events.all(Payload, Options, EventName);
        }
    }

    function onFocus(id) {
        var elem = $('#' + id);  
        var value = elem.val();
        //needed for checkboxes, will overwrite
        if (elem.is(':checkbox')) {
            if (elem.is(':checked')) {
                value = true;
            } else {
                value = false;
            } 
        }

        //set default values
        _Fields[id].oldValue = value;
        _Fields[id].newValue = value;
        _Fields[id].state = 'clean';
        _Fields[id].emittedDirty = false; //to prevent extra emits when typing
         
    }

    function onEdit(id) {
        var elem = $('#' + id); 
        _Fields[id].newValue = elem.val();
        //needed for checkboxes, will overwrite
        if (elem.is(':checkbox')) {
            if (elem.is(':checked')) {
                _Fields[id].newValue = true;
            } else {
                _Fields[id].newValue = false;
            } 
        }

        if (_Fields[id].newValue !== _Fields[id].oldValue) {
            _Fields[id].state = 'dirty';
            elem.addClass(_ClassName + '-dirty');
            elem.removeClass(_ClassName + '-saving');
            elem.removeClass(_ClassName + '-saved');
            if (! _Fields[id].emittedDirty) {
                emit('state', _Fields[id].fieldName, _Fields);
                _Fields[id].emittedDirty = true;
            }

        } else {
            _Fields[id].emittedDirty = false;
            _Fields[id].state = 'clean';
            elem.removeClass(_ClassName + '-dirty');
            emit('state', _Fields[id].fieldName, _Fields);
        }
        
    }

    this.saveField = function(id) {
        onChange(id);
    };

    function onChange(id) {
        //if the user has supplied an update callback
        if (typeof _UpdateFunction === 'function') {
            //test to see if the validation exists and is successful:
            saveField(id); 
        }  
    }

    function saveField(id) {
        var elem = $('#' + id); 

        _Fields[id].newValue = elem.val();
        //needed for checkboxes, will overwrite
        if (elem.is(':checkbox')) {
            if (elem.is(':checked')) {
                _Fields[id].newValue = true;
            } else {
                _Fields[id].newValue = false;
            } 
        }

        //format the value of the field
        if (typeof _Formatting[_Fields[id].fieldName] === 'function') {
            _Fields[id].newValue = _Formatting[_Fields[id].fieldName](_Fields[id].newValue);
            elem.val(_Fields[id].newValue);
        }

        //test for field validity
        //if false, emit 'invalid' and exit function
        if (typeof _Validation[_Fields[id].fieldName] === 'function') {
            if (_Validation[_Fields[id].fieldName](_Fields[id].newValue) === false) {
                emit('invalid', _Fields[id].fieldName, _Fields);
                return false;
            }
        }

        _Fields[id].state = 'saving';
        
        //set the classes
        elem.removeClass(_ClassName + '-dirty');
        elem.removeClass(_ClassName + '-saved');
        elem.addClass(_ClassName + '-saving');

        //emit the saving state
        emit('state', _Fields[id].fieldName, _Fields);
        
        //disable the control
        if (_AutoDisable) { elem.attr('disabled', 'disabled'); }
        //run the update callback
        _UpdateFunction(_Fields[id].fieldName, _Fields[id].oldValue, _Fields[id].newValue,
            function(success) {
                if (typeof success === 'undefined') { success = true; }

                elem.removeClass(_ClassName + '-saving');
                if (_AutoDisable) { elem.removeAttr('disabled'); }
                if (success) {
                    elem.addClass(_ClassName + '-saved');
                    _Fields[id].state = 'clean';
                } else {
                    elem.addClass(_ClassName + '-dirty');
                    _Fields[id].state = 'dirty';
                }
                emit('state', _Fields[id].fieldName, _Fields);
        });
    }

    function onFocusOut(id) {
        var elem = $('#' + id); 
        var value = elem.val();
        //needed for checkboxes, will overwrite
        if (elem.is(':checkbox')) {
            if (elem.is(':checked')) {
                value = true;
            } else {
                value = false;
            } 
        }
        if (_Fields[id].oldValue === value) {
            _Fields[id].saved = true;
            elem.removeClass(_ClassName + '-dirty');   
        }
        emit('state', _Fields[id].fieldName, _Fields);
    }

    (function init() {
        $('.' + _ClassName).each(function() {
            //try to use the id as the object key
            var elemID = $(this).attr('id');
            
            //add the fieldname to the fields object
            //try 3 common cases TODO: better way?
            var fieldName = $(this).attr('fieldName');
            if (typeof fieldName === 'undefined') {
                fieldName = $(this).attr('fieldname');
            }
            if (typeof fieldName === 'undefined') {
                fieldName = $(this).attr('FieldName');
            }

            _Fields[elemID] = {
                fieldName: fieldName
            };

            //create the handlers
            $(this).focus(function() {
                onFocus(elemID);
            });
            
            $(this).keyup(function() {
                onEdit(elemID);    
            });

            //this needs a short timeout so that it can capture the value
            $(this).on('paste',function() {
                setTimeout(function() {
                    onEdit(elemID); 
                }, 250);   
            });

            $(this).on('cut',function() {
                setTimeout(function() {
                    onEdit(elemID); 
                }, 250);   
            });

            $(this).change(function() {
                onChange(elemID);
            });

            $(this).focusout(function() {
                onFocusOut(elemID);
            });
        });
    })();

    /********************************************************************************/
    this.on = function(EventName, Callback) {
        //attaches a callback function to an event
        _Events[EventName] = Callback;
    };

    this.state = function() {
        //returns the state of the group of autoupdate controls
        var state = 'clean';
        var IDs = Object.keys(_Fields);
        for (var i=0; i<IDs.length; i++) {
            if (_Fields[IDs[i]].state === 'dirty') {
                state = 'dirty';
            } else if (_Fields[IDs[i]].state === 'saving') {
                state = 'saving';
                return state;
            }
        }

        return state;
    };

    this.fields = function() {
        return JSON.parse(JSON.stringify(_Fields)); //returns a copy
    };

    this.save = function() {
        //attempts to force-save dirty fields
        var IDs = Object.keys(_Fields);

        IDs.forEach(function(id) {
            if (_Fields[id].state === 'dirty') {
                saveField(id);
            }
        });
    };

}