/**
 *               AutoNumeric.js
 *
 * @version      3.0.0-beta.7
 * @date         2017-03-03 UTC 20:40
 *
 * @author       Bob Knothe
 * @contributors Alexandre Bonneau, Sokolov Yura and others, cf. AUTHORS.md
 * @copyright    2009 Robert J. Knothe http://www.decorplanit.com/plugin/
 * @since        2009-08-09
 *
 * @summary      autoNumeric is a library that provides live as-you-type
 *               formatting for international numbers and currencies.
 *
 *               Note : Some functions are borrowed from big.js
 * @link         https://github.com/MikeMcl/big.js/
 *
 * Please report any bugs to https://github.com/BobKnothe/autoNumeric
 *
 * @license      Released under the MIT License
 * @link         http://www.opensource.org/licenses/mit-license.php
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sub license, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

/* global module */

//TODO Prevent having to enter relative path in the js files (ie. using `./AutoNumericHelper` instead of just `AutoNumericHelper`) (cf. http://moduscreate.com/es6-es2015-import-no-relative-path-webpack/)
import AutoNumericHelper from './AutoNumericHelper';
import AutoNumericEnum from './AutoNumericEnum';

/**
 * Class declaration for the AutoNumeric object.
 *
 * An AutoNumeric element is an object wrapper that keeps a reference to the DOM element it manages (usually an <input> one), and provides autoNumeric-specific variables and functions.
 */
class AutoNumeric {
    //TODO Use the better notation `export default class` when webpack and babel will allow it (cf. https://github.com/webpack/webpack/issues/706)
    /**
     * Initialize the AutoNumeric object onto the given DOM element, and attach the settings and related event listeners to it.
     * The options passed as a parameter is an object that contains the settings (ie. {digitGroupSeparator: ".", decimalCharacter: ",", currencySymbol: '€ '})
     *
     * @example
     * anElement = new AutoNumeric(domElement); // With the default options
     * anElement = new AutoNumeric(domElement, { options }); // With one option object
     * anElement = new AutoNumeric(domElement, null, { options }); // With one option object, and a failed initial value
     * anElement = new AutoNumeric(domElement).french(); // With one pre-defined language object
     * anElement = new AutoNumeric(domElement).french({ options });// With one pre-defined language object and additional options that will override the defaults
     *
     * // ...or init and set the value in one call :
     * anElement = new AutoNumeric(domElement, 12345.789); // With the default options, and an initial value
     * anElement = new AutoNumeric(domElement, 12345.789, { options });
     * anElement = new AutoNumeric(domElement, '12345.789', { options });
     * anElement = new AutoNumeric(domElement, 12345.789).french({ options });
     * anElement = new AutoNumeric(domElement, 12345.789, { options }).french({ options }); // Not really helpful, but possible
     *
     * // The AutoNumeric constructor class can also accept a string as a css selector. Under the hood this use `QuerySelector` and limit itself to only the first element it finds.
     * anElement = new AutoNumeric('.myCssClass > input');
     * anElement = new AutoNumeric('.myCssClass > input', { options });
     * anElement = new AutoNumeric('.myCssClass > input', 12345.789);
     * anElement = new AutoNumeric('.myCssClass > input', 12345.789, { options });
     * anElement = new AutoNumeric('.myCssClass > input', null, { options }); // With a failed initial value
     * anElement = new AutoNumeric('.myCssClass > input', 12345.789).french({ options });
     *
     * @param {object|Array|number|string} arg1
     * @param {object|Array|number|string|null} arg2
     * @param {object|Array|number|string|null} arg3
     * @throws
     */
    constructor(arg1 = null, arg2 = null, arg3 = null) {
        // --------------------------------------------------------
        // -------------- Initialization
        // Initialize the arguments
        const { domElement, initialValue, userOptions } = AutoNumeric._setArgumentsValues(arg1, arg2, arg3);

        // Initialize the element
        this.domElement = domElement;

        // Generate the settings
        this._setSettings(userOptions, false);
        // Check if the DOM element is supported
        this._checkElement();

        // Store the additional attributes inside the AutoNumeric object
        // Note: This variable is needed and not a duplicate of `initialValueOnKeydown` nor `valueOnFocus` since it serves a different purpose and has a different lifecycle
        this.savedCancellableValue = null;
        // console.log('constructor(): domElement:', domElement, 'initialValue:', initialValue, 'userOptions:', userOptions); //DEBUG

        // Set the initial value if it exists and if the `formatOnPageLoad` option will allow it
        if (!this.runOnce && this.settings.formatOnPageLoad) {
            // Format the element value if needed
            this._formatDefaultValueOnPageLoad(initialValue);
        }

        this.runOnce = true;

        // Add the events listeners only on input elements
        if (this.isInputElement || this.isContentEditable) {
            if (!this.settings.noEventListeners) {
                //XXX Here we make sure the global list is created after creating the event listeners, to only create the event listeners on `document` once
                this._createEventListeners();
            }

            if (this.isInputElement && this.settings.readOnly) {
                this.domElement.readOnly = true;
            }
        }

        // Save the initial values (html attribute + element.value) for the pristine test
        this._saveInitialValues(initialValue);

        // --------------------------------------------------------
        // -------------- Tracking
        // Keep track if the element is currently focused
        this.isFocused = false;

        // Keep track of every AutoNumeric elements that this object initialized
        this._createLocalList();

        // Keep track of all AutoNumeric elements in the current web page
        this.constructor._addToGlobalList(this);

        // --------------------------------------------------------
        // -------------- Methods
        // Create the global functions
        this.global = {
            /**
             * Set the same given element value for each elements in the local AutoNumeric element list, and format those elements immediately
             *
             * @param {number|string} newValue The value must be a number or a numeric string
             * @param {object} options A settings object that will override the current settings. Note: the update is done only if the `newValue` is defined.
             */
            set: (newValue, options = null) => {
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.set(newValue, options);
                });
            },

            /**
             * Set the value given value directly as the DOM element value, without formatting it beforehand.
             * This sets the same unformatted value for each elements in the local AutoNumeric element list.
             *
             * @param {number|string} value
             * @param {object} options
             */
            setUnformatted: (value, options = null) => {
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.setUnformatted(value, options);
                });
            },

            /**
             * This is an alias of the `getNumericString()` function, and should not be used anymore.
             *
             * @returns {Array<string>}
             * @deprecated
             */
            get: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.get());
                });

                return result;
            },

            /**
             * Return an array of the unformatted values (as a string) of each AutoNumeric element of the local AutoNumeric element list
             *
             * @returns {Array<string>}
             */
            getNumericString: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.getNumericString());
                });

                return result;
            },

            /**
             * Return an array of the current formatted values (as a string) of each AutoNumeric element of the local AutoNumeric element list
             *
             * @returns {Array<string>}
             */
            getFormatted: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.getFormatted());
                });

                return result;
            },

            /**
             * Return an array of the element unformatted values (as a real Javascript number), for each element of the local AutoNumeric element list
             *
             * @returns {Array<number>}
             */
            getNumber: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.getNumber());
                });

                return result;
            },

            /**
             * Returns the unformatted values (following the `outputFormat` setting) of each element of the local AutoNumeric element list into an array
             *
             * @returns {Array<string>}
             */
            getLocalized: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.getLocalized());
                });

                return result;
            },

            /**
             * Force each element of the local AutoNumeric element list to reformat its value
             */
            reformat: () => {
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.reformat();
                });
            },

            /**
             * Remove the formatting and keep only the raw unformatted value (as a numericString) in each elements of the local AutoNumeric element list
             */
            unformat: () => {
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.unformat();
                });
            },

            /**
             * Remove the formatting and keep only the localized unformatted value in the element, with the option to override the default outputFormat if needed
             *
             * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
             */
            unformatLocalized: (forcedOutputFormat = null) => {
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.unformatLocalized(forcedOutputFormat);
                });
            },

            /**
             * Return `true` is *all* the autoNumeric-managed elements are pristine, if their raw value hasn't changed.
             * By default, this returns `true` if the raw unformatted value is still the same even if the formatted one has changed (due to a configuration update for instance).
             *
             * @param {boolean} checkOnlyRawValue If set to `true`, the pristine value is done on the raw unformatted value, not the formatted one. If set to `false`, this also checks that the formatted value hasn't changed.
             * @returns {boolean}
             */
            isPristine: (checkOnlyRawValue = true) => {
                let isPristine = true;
                this.autoNumericLocalList.forEach(aNObject => {
                    if (isPristine && !aNObject.isPristine(checkOnlyRawValue)) {
                        isPristine = false;
                    }
                });

                return isPristine;
            },

            /**
             * Execute the `clear()` method on each AutoNumeric object in the local AutoNumeric element list
             */
            clear: () => { //FIXME à tester
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.clear();
                });
            },

            /**
             * Execute the `remove()` method on each AutoNumeric object in the local AutoNumeric element list
             */
            remove: () => { //FIXME à tester
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.remove();
                });
            },

            /**
             * Execute the `wipe()` method on each AutoNumeric object in the local AutoNumeric element list
             */
            wipe: () => { //FIXME à tester
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.wipe();
                });
            },

            /**
             * Return `true` if the given AutoNumeric object (or DOM element) is in the local AutoNumeric element list
             *
             * @param {HTMLElement|HTMLInputElement|AutoNumeric} domElementOrAutoNumericObject
             * @returns {*}
             */
            has: domElementOrAutoNumericObject => { //FIXME à tester
                let result;
                if (domElementOrAutoNumericObject instanceof AutoNumeric) {
                    result = this.autoNumericLocalList.has(domElementOrAutoNumericObject.node());
                } else {
                    result = this.autoNumericLocalList.has(domElementOrAutoNumericObject);
                }

                return result;
            },

            /**
             * Add an existing AutoNumeric object (or DOM element) to the local AutoNumeric element list, using the DOM element as the key
             *
             * @param {HTMLElement|HTMLInputElement|AutoNumeric} domElementOrAutoNumericObject
             */
            addObject: domElementOrAutoNumericObject => { //FIXME à tester
                if (domElementOrAutoNumericObject instanceof AutoNumeric) {
                    this._addToLocalList(domElementOrAutoNumericObject.node(), domElementOrAutoNumericObject);
                } else {
                    // We need to specify the AutoNumeric object, otherwise the `_addToLocalList` function would not correctly add the AutoNumeric object since we would not have a reference to it, but a reference to the current AutoNumeric object on which is called this method.
                    this._addToLocalList(domElementOrAutoNumericObject, AutoNumeric.getAutoNumericElement(domElementOrAutoNumericObject));
                }
            },

            /**
             * Remove the given AutoNumeric object (or DOM element) from the local AutoNumeric element list, using the DOM element as the key
             *
             * @param {HTMLElement|HTMLInputElement|AutoNumeric} domElementOrAutoNumericObject
             */
            removeObject: domElementOrAutoNumericObject => { //FIXME à tester
                if (domElementOrAutoNumericObject instanceof AutoNumeric) {
                    this.autoNumericLocalList.delete(domElementOrAutoNumericObject.node());
                } else {
                    this.autoNumericLocalList.delete(domElementOrAutoNumericObject);
                }
            },

            /**
             * Remove all elements from the shared list, effectively emptying it.
             * This is the equivalent of calling `detach()` on each of its elements.
             */
            empty: () => { //FIXME à tester
                this.autoNumericLocalList.forEach(aNObject => {
                    aNObject.detach();
                });
            },

            /**
             * Return an array containing all the AutoNumeric DOM elements that have been initialized by each other
             *
             * @returns {Array<HTMLElement>}
             */
            elements: () => { //FIXME à tester
                const result = [];
                this.autoNumericLocalList.forEach(aNObject => {
                    result.push(aNObject.node());
                });

                return result;
            },

            /**
             * Return the `Map` object directly
             * @returns {Map}
             */
            getList: () => this.autoNumericLocalList, //FIXME à tester

            /**
             * Return the number of element in the local AutoNumeric element list
             * @returns {number}
             */
            size: () => this.autoNumericLocalList.size,
        };

        // Create the functions that will allow to change each setting one by one
        /**
         * For each options, we define if we need to reformat the element content (does changing the options should change the way its value is displayed?).
         * If yes, then we use the `update()` for force a reformat, otherwise, we just update the `settings` object.
         */
        this.options = { //FIXME à tester -->
            digitGroupSeparator          : digitGroupSeparator => {
                this.update({ digitGroupSeparator });
            },
            noSeparatorOnFocus           : noSeparatorOnFocus => {
                this.update({ noSeparatorOnFocus });
            },
            digitalGroupSpacing          : digitalGroupSpacing => {
                this.update({ digitalGroupSpacing });
            },
            decimalCharacter             : decimalCharacter => {
                this.update({ decimalCharacter });
            },
            decimalCharacterAlternative  : decimalCharacterAlternative => {
                this.settings.decimalCharacterAlternative = decimalCharacterAlternative; //FIXME à tester
            },
            currencySymbol               : currencySymbol => {
                this.update({ currencySymbol });
            },
            currencySymbolPlacement      : currencySymbolPlacement => {
                this.update({ currencySymbolPlacement });
            },
            negativePositiveSignPlacement: negativePositiveSignPlacement => {
                this.update({ negativePositiveSignPlacement });
            },
            showPositiveSign             : showPositiveSign => {
                this.update({ showPositiveSign });
            },
            suffixText                   : suffixText => {
                this.update({ suffixText });
            },
            overrideMinMaxLimits         : overrideMinMaxLimits => {
                this.update({ overrideMinMaxLimits });
            },
            maximumValue                 : maximumValue => {
                this.update({ maximumValue });
            },
            minimumValue                 : minimumValue => {
                this.update({ minimumValue });
            },
            decimalPlacesOverride        : decimalPlacesOverride => {
                this.update({ decimalPlacesOverride });
            },
            decimalPlacesShownOnFocus    : decimalPlacesShownOnFocus => {
                this.update({ decimalPlacesShownOnFocus });
            },
            scaleDivisor                 : scaleDivisor => {
                this.update({ scaleDivisor });
            },
            scaleDecimalPlaces           : scaleDecimalPlaces => {
                this.update({ scaleDecimalPlaces });
            },
            scaleSymbol                  : scaleSymbol => {
                this.update({ scaleSymbol });
            },
            saveValueToSessionStorage    : saveValueToSessionStorage => {
                this.update({ saveValueToSessionStorage });
            },
            onInvalidPaste               : onInvalidPaste => {
                this.settings.onInvalidPaste = onInvalidPaste; //FIXME à tester
            },
            roundingMethod               : roundingMethod => {
                this.update({ roundingMethod });
            },
            allowDecimalPadding          : allowDecimalPadding => {
                this.update({ allowDecimalPadding });
            },
            negativeBracketsTypeOnBlur   : negativeBracketsTypeOnBlur => {
                this.update({ negativeBracketsTypeOnBlur });
            },
            emptyInputBehavior           : emptyInputBehavior => {
                this.update({ emptyInputBehavior });
            },
            leadingZero                  : leadingZero => {
                this.update({ leadingZero });
            },
            formatOnPageLoad             : formatOnPageLoad => {
                this.settings.formatOnPageLoad = formatOnPageLoad; //FIXME à tester
            },
            selectNumberOnly             : selectNumberOnly => {
                this.settings.selectNumberOnly = selectNumberOnly; //FIXME à tester
            },
            defaultValueOverride         : defaultValueOverride => {
                this.update({ defaultValueOverride });
            },
            unformatOnSubmit             : unformatOnSubmit => {
                this.settings.unformatOnSubmit = unformatOnSubmit; //FIXME à tester
            },
            outputFormat                 : outputFormat => {
                this.settings.outputFormat = outputFormat; //FIXME à tester
            },
            isCancellable                : isCancellable => {
                this.settings.isCancellable = isCancellable; //FIXME à tester
            },
            modifyValueOnWheel           : modifyValueOnWheel => {
                this.settings.modifyValueOnWheel = modifyValueOnWheel; //FIXME à tester
            },
            wheelStep                    : wheelStep => {
                this.settings.wheelStep = wheelStep; //FIXME à tester
            },
            serializeSpaces              : serializeSpaces => {
                this.settings.serializeSpaces = serializeSpaces; //FIXME à tester
            },
            showWarnings                 : showWarnings => {
                this.settings.showWarnings = showWarnings; //FIXME à tester
            },
            //FIXME Add the noEventListeners and readOnly options too?
            failOnUnknownOption          : failOnUnknownOption => {
                this.settings.failOnUnknownOption = failOnUnknownOption; //FIXME à tester
            },
        };
    }

    /**
     * Return the autoNumeric version number (for debugging purpose)
     *
     * @returns {string}
     */
    static version() {
        return '3.0.0-beta.7';
    }

    /**
     * Take the parameters given to the AutoNumeric object, and output the three variables that are needed to finish initializing it :
     * - domElement : The target DOM element
     * - initialValue : The initial value, or `null` if none is given
     * - userOptions : The option object
     *
     * @param {object|Array|number|string} arg1
     * @param {object|Array|number|string|null} arg2
     * @param {object|Array|number|string|null} arg3
     * @returns {{domElement: *, initialValue: *, userOptions: *}}
     * @private
     */
    static _setArgumentsValues(arg1, arg2, arg3) {
        // Basic check on the argument count
        const isArg1Null = AutoNumericHelper.isNull(arg1);
        if (isArg1Null) {
            AutoNumericHelper.throwError('At least one parameter is needed in order to initialize an AutoNumeric object');
        }

        // Prepare the arguments in order to create the AutoNumeric object with the right values
        // Test the argument types
        const isArg1Element = AutoNumericHelper.isElement(arg1);
        const isArg1String = AutoNumericHelper.isString(arg1);

        const isArg2Object = AutoNumericHelper.isObject(arg2);
        const isArg2Number = AutoNumericHelper.isNumberOrArabic(arg2) || arg2 === '';
        const isArg2Null = AutoNumericHelper.isNull(arg2);
        const isArg2EmptyString = AutoNumericHelper.isEmptyString(arg2);

        const isArg3Object = AutoNumericHelper.isObject(arg3);
        const isArg3Null = AutoNumericHelper.isNull(arg3);
        // console.log('isArg1Element, isArg2Null, isArg3Null:', isArg1Element, isArg2Null, isArg3Null); //DEBUG
        // console.log('arg1, arg2, arg3:', arg1, arg2, arg3); //DEBUG

        // Given the parameters passed, sort the data and return a stable state before the initialization
        let domElement;
        let userOptions;
        let initialValue;

        if (isArg1Element && isArg2Null && isArg3Null) {
            // new AutoNumeric(domElement); // With the default options
            domElement = arg1;
            initialValue = null;
            userOptions = null;
            // console.log(`Init 1`, domElement); //DEBUG
        } else if (isArg1Element && isArg2Number && isArg3Null) {
            // new AutoNumeric(domElement, 12345.789); // With the default options, and an initial value
            domElement = arg1;
            initialValue = arg2;
            userOptions = null;
            // console.log(`Init 2`, domElement, initialValue); //DEBUG
        } else if (isArg1Element && isArg2Object && isArg3Null) {
            // new AutoNumeric(domElement, { options }); // With one option object
            domElement = arg1;
            initialValue = null;
            userOptions = arg2;
            // console.log(`Init 3a`, domElement, userOptions); //DEBUG
        } else if (isArg1Element && (isArg2Null || isArg2EmptyString) && isArg3Object) {
            // new AutoNumeric(domElement, null, { options }); // With one option object
            domElement = arg1;
            initialValue = null;
            userOptions = arg3;
            // console.log(`Init 3b`, domElement, userOptions); //DEBUG
        } else if (isArg1String && isArg2Null && isArg3Null) {
            // new AutoNumeric('.myCssClass > input');
            domElement = document.querySelector(arg1);
            initialValue = null;
            userOptions = null;
            // console.log(`Init 4`, domElement); //DEBUG
        } else if (isArg1String && isArg2Object && isArg3Null) {
            // new AutoNumeric('.myCssClass > input', { options });
            domElement = document.querySelector(arg1);
            initialValue = null;
            userOptions = arg2;
            // console.log(`Init 5a`, domElement, userOptions); //DEBUG
        } else if (isArg1String && (isArg2Null || isArg2EmptyString) && isArg3Object) {
            // new AutoNumeric('.myCssClass > input', null, { options });
            domElement = document.querySelector(arg1);
            initialValue = null;
            userOptions = arg3;
            // console.log(`Init 5b`, domElement, userOptions); //DEBUG
        } else if (isArg1String && isArg2Number && isArg3Null) {
            // new AutoNumeric('.myCssClass > input', 12345.789);
            domElement = document.querySelector(arg1);
            initialValue = arg2;
            userOptions = null;
            // console.log(`Init 6`, domElement, initialValue); //DEBUG
        } else if (isArg1String && isArg2Number && isArg3Object) {
            // new AutoNumeric('.myCssClass > input', 12345.789, { options });
            domElement = document.querySelector(arg1);
            initialValue = arg2;
            userOptions = arg3;
            // console.log(`Init 7`, domElement, initialValue, userOptions); //DEBUG
        } else if (isArg1Element && isArg2Number && isArg3Object) {
            // new AutoNumeric(domElement, 12345.789, { options });
            domElement = arg1;
            initialValue = arg2;
            userOptions = arg3;
            // console.log(`Init 8`, domElement, initialValue, userOptions); //DEBUG
        }
        else {
            AutoNumericHelper.throwError(`The parameters given to the AutoNumeric object are not valid, '${arg1}', '${arg2}' and '${arg3}' given.`); //TODO Change the error message based on the number of argument passed
        }
        // console.log('_setArgumentsValues(): domElement:', domElement, 'initialValue:', initialValue, 'userOptions:', userOptions); //DEBUG
        // console.log('isInitialElementAForm:', isInitialElementAForm); //DEBUG

        return { domElement, initialValue, userOptions };
    }

    /**
     * Save the initial element values for later use in the pristine test.
     * Those values are :
     * - the html attribute (ie. <input value='42'>), and
     * - the script `value` (ie. `let domElement.value`)
     *
     * @param {null|number|string} initialValue
     * @private
     */
    _saveInitialValues(initialValue) {
        // Keep the very first initial values (in the html attribute and set by the script). This is needed to check if the element is pristine.
        // Save the html attribute 'value'
        this.initialValueHtmlAttribute = this.domElement.getAttribute('value');
        if (AutoNumericHelper.isNull(this.initialValueHtmlAttribute)) {
            // Set the default empty value attribute instead of `null`, since if the initial value is null, the empty string is used
            this.initialValueHtmlAttribute = '';
        }

        // Save the 'script' value
        this.initialValue = initialValue;
        if (AutoNumericHelper.isNull(this.initialValue)) {
            // Same as above
            this.initialValue = '';
        }
    }

    /**
     * Generate all the event listeners for the given DOM element
     * @private
     */
    _createEventListeners() {
        // Create references to the event handler functions, so we can then cleanly removes those listeners if needed
        // That would not be possible if we used closures directly in the event handler declarations
        this._onFocusInAndMouseEnterFunc = e => { this._onFocusInAndMouseEnter(e); };
        this._onFocusFunc = () => { this._onFocus(); };
        this._onFocusOutAndMouseLeaveFunc = e => { this._onFocusOutAndMouseLeave(e); };
        this._onKeydownFunc = e => { this._onKeydown(e); };
        this._onKeypressFunc = e => { this._onKeypress(e); };
        this._onKeyupFunc = e => { this._onKeyup(e); };
        this._onBlurFunc = e => { this._onBlur(e); };
        this._onPasteFunc = e => { this._onPaste(e); };
        this._onWheelFunc = e => { this._onWheel(e); };
        this._onFormSubmitFunc = e => { this._onFormSubmit(e); };
        this._onKeydownGlobalFunc = e => { this._onKeydownGlobal(e); };
        this._onKeyupGlobalFunc = e => { this._onKeyupGlobal(e); };

        // Add the event listeners
        this.domElement.addEventListener('focusin', this._onFocusInAndMouseEnterFunc, false);
        this.domElement.addEventListener('focus', this._onFocusFunc, false);
        this.domElement.addEventListener('mouseenter', this._onFocusInAndMouseEnterFunc, false);
        this.domElement.addEventListener('blur', this._onFocusOutAndMouseLeaveFunc, false);
        this.domElement.addEventListener('mouseleave', this._onFocusOutAndMouseLeaveFunc, false);
        this.domElement.addEventListener('keydown', this._onKeydownFunc, false);
        this.domElement.addEventListener('keypress', this._onKeypressFunc, false);
        this.domElement.addEventListener('keyup', this._onKeyupFunc, false);
        this.domElement.addEventListener('blur', this._onBlurFunc, false);
        this.domElement.addEventListener('paste', this._onPasteFunc, false);
        this.domElement.addEventListener('wheel', this._onWheelFunc, false);

        const parentForm = this.form();
        if (!AutoNumericHelper.isNull(parentForm)) {
            parentForm.addEventListener('submit.autoNumeric', this._onFormSubmitFunc, false); //FIXME à tester
        }

        // Create one global event listener for the keyup event on the document object, which will be shared by all the autoNumeric elements
        if (!AutoNumeric._doesGlobalListExists()) {
            document.addEventListener('keydown', this._onKeydownGlobalFunc, false);
            document.addEventListener('keyup', this._onKeyupGlobalFunc, false);
        }
    }

    /**
     * Remove all the autoNumeric-related event listeners for the given DOM element
     * @private
     */
    _removeEventListeners() { //FIXME à tester
        this.domElement.removeEventListener('focusin', this._onFocusInAndMouseEnterFunc, false);
        this.domElement.removeEventListener('focus', this._onFocusFunc, false);
        this.domElement.removeEventListener('mouseenter', this._onFocusInAndMouseEnterFunc, false);
        this.domElement.removeEventListener('blur', this._onFocusOutAndMouseLeaveFunc, false);
        this.domElement.removeEventListener('mouseleave', this._onFocusOutAndMouseLeaveFunc, false);
        this.domElement.removeEventListener('keydown', this._onKeydownFunc, false);
        this.domElement.removeEventListener('keypress', this._onKeypressFunc, false);
        this.domElement.removeEventListener('keyup', this._onKeyupFunc, false);
        this.domElement.removeEventListener('blur', this._onBlurFunc, false);
        this.domElement.removeEventListener('paste', this._onPasteFunc, false);
        this.domElement.removeEventListener('wheel', this._onWheelFunc, false);

        document.removeEventListener('keydown', this._onKeydownGlobalFunc, false);
        document.removeEventListener('keyup', this._onKeyupGlobalFunc, false);

        const parentForm = this.form();
        if (!AutoNumericHelper.isNull(parentForm)) {
            parentForm.removeEventListener('submit.autoNumeric', this._onFormSubmitFunc, false);
        }
    }

    // This are the public function available on each autoNumeric-managed element

    /**
     * Method that updates the AutoNumeric settings, and immediately format the element accordingly.
     * The options passed as a parameter is an object that contains the settings, ie. :
     * {
     *     digitGroupSeparator: ".",
     *     decimalCharacter: ",",
     *     currencySymbol: '€ ',
     * }
     *
     * @example anElement.update({ options }) // Updates the settings
     *
     * @param {object} newOptions
     * @returns {AutoNumeric}
     */
    update(newOptions) {
        // Store the current unformatted input value
        const numericString = this.settings.rawValue;

        // Update the settings
        try {
            this._setSettings(newOptions, true);
        } catch (error) {
            AutoNumericHelper.throwError('Unable to update the settings, those are invalid.');

            return this;
        }

        // Update other variables
        //TODO Evaluate if the following variable needs to be updated as well
        this.savedCancellableValue = null;

        // Reformat the input value with the new settings
        if (AutoNumericHelper.getElementValue(this.domElement) !== '') {
            this.set(numericString);
        }

        return this;
    }

    /**
     * Return the options object containing all the current autoNumeric settings in effect.
     * You can then directly access each option by using its name : `anElement.getSettings().optionNameAutoCompleted`.
     *
     * @example
     * anElement.getSettings()
     * anElement.getSettings().decimalCharacter // Return the decimalCharacter setting as a string - any valid option name can be used
     *
     * @returns {object}
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Set the given element value, and format it immediately.
     * Additionally, this `set()` method can accept options that will be merged into the current AutoNumeric element, taking precedence over any previous settings.
     *
     * @example anElement.set('12345.67') // Formats the value
     * @example anElement.set(12345.67) // Formats the value
     * @example anElement.set(12345.67, { decimalCharacter : ',' }) // Update the settings and formats the value in one go
     *
     * @param {number|string} newValue The value must be a number or a numeric string
     * @param {object} options A settings object that will override the current settings. Note: the update is done only if the `newValue` is defined.
     * @returns {AutoNumeric}
     */
    set(newValue, options = null) {
        //TODO Add the `saveSettings` options. If `true`, then when `options` is passed, then it overwrite the current `this.settings`. If `false` the `options` are only used once and `this.settings` is not modified
        if (newValue === null || AutoNumericHelper.isUndefined(newValue)) {
            return this;
        }

        // The options update is done only if the `newValue` is not null
        if (!AutoNumericHelper.isNull(options)) {
            this._setSettings(options, true); // We do not call `update` here since this would call `set` too
        }

        //TODO This looks a lot like `getInputIfSupportedTagAndType()`. Is that necessary? Can the input element be changed since autoNumeric has been initialized?
        // Reset the trailing negative settings, since it's possible the previous value was negative, but not the newly set one
        this.settings.trailingNegative = false; //TODO Use a separate variable to store that info (`this.tempEditing` object for instance?)

        let value = this.constructor._toNumericValue(newValue, this.settings);
        if (isNaN(Number(value))) {
            AutoNumericHelper.setElementValue(this.domElement, '');
            this.settings.rawValue = '';

            return this;
        }

        if (value !== '') {
            const [minTest, maxTest] = this.constructor._checkIfInRangeWithOverrideOption(value, this.settings);
            // This test is needed by the showPositiveSign option
            const isZero = AutoNumericHelper.isZeroOrHasNoValue(value);
            if (isZero) {
                value = '0';
            }

            if (minTest && maxTest) {
                // Ensure rounding does not happen twice
                let hasBeenRounded = false;

                // Rounds the extended decimal places
                let tempDecimal;
                if (this.settings.decimalPlacesShownOnFocus) {
                    tempDecimal = this.settings.decimalPlacesOverride;
                    this.settings.decimalPlacesOverride = Number(this.settings.decimalPlacesShownOnFocus);
                    value = this.constructor._roundValue(value, this.settings);
                    hasBeenRounded = true;
                    this.settings.decimalPlacesOverride = tempDecimal;
                }

                if (this.settings.scaleDivisor && !this.settings.hasFocus) {
                    value = this.constructor._roundValue(value, this.settings);
                    this.settings.rawValue = this._cleanLeadingTrailingZeros(value.replace(this.settings.decimalCharacter, '.'));
                    value = this.constructor._toNumericValue(value, this.settings);
                    value = value / this.settings.scaleDivisor;
                    value = value.toString();
                    if (this.settings.scaleDecimalPlaces) {
                        tempDecimal = this.settings.decimalPlacesOverride;
                        this.settings.decimalPlacesOverride = Number(this.settings.scaleDecimalPlaces);
                        value = this.constructor._roundValue(value, this.settings);
                        hasBeenRounded = true;
                    }
                }

                // Rounds if this has not been done already
                if (!hasBeenRounded) {
                    value = this.constructor._roundValue(value, this.settings);
                }

                // Stores rawValue including the decimalPlacesShownOnFocus
                if (!this.settings.scaleDivisor) {
                    this.settings.rawValue = this._cleanLeadingTrailingZeros(value.replace(this.settings.decimalCharacter, '.'));
                }

                value = this.constructor._modifyNegativeSignAndDecimalCharacterForFormattedValue(value, this.settings);
                value = this.constructor._addGroupSeparators(value, this.settings);

                if (this.settings.scaleDivisor && this.settings.scaleDecimalPlaces && !this.settings.hasFocus) {
                    this.settings.decimalPlacesOverride = tempDecimal;
                }

                if (this.settings.saveValueToSessionStorage && (this.settings.decimalPlacesShownOnFocus || this.settings.scaleDivisor)) {
                    this._saveValueToPersistentStorage('set');
                }
            } else {
                this.settings.rawValue = '';
                this._saveValueToPersistentStorage('remove');
                const attemptedValue = value;
                value = '';

                if (!minTest) {
                    AutoNumericHelper.triggerEvent('autoNumeric:minExceeded', this.domElement);
                }

                if (!maxTest) {
                    AutoNumericHelper.triggerEvent('autoNumeric:maxExceeded', this.domElement);
                }

                AutoNumericHelper.throwError(`The value [${attemptedValue}] being set falls outside of the minimumValue [${this.settings.minimumValue}] and maximumValue [${this.settings.maximumValue}] range set for this element`);

                AutoNumericHelper.setElementValue(this.domElement, '');

                return this;
            }
        } else {
            AutoNumericHelper.setElementValue(this.domElement, '');
            this.settings.rawValue = '';

            return this;
        }

        if (!this.settings.hasFocus && this.settings.scaleSymbol) {
            value = value + this.settings.scaleSymbol;
        }

        AutoNumericHelper.setElementValue(this.domElement, value);

        return this;
    }

    /**
     * Set the value given value directly as the DOM element value, without formatting it beforehand.
     * You can also set the value and update the setting in one go (the value will again not be formatted immediately).
     *
     * @param {number|string} value
     * @param {object} options
     * @returns {AutoNumeric}
     */
    setUnformatted(value, options = null) {
        AutoNumericHelper.setElementValue(this.domElement, value);

        // Update the rawValue and the savedCancellableValue values //FIXME à tester
        this.settings.rawValue = value; // Doing this without any test can lead to badly formatted rawValue
        this._saveCancellableValue();

        if (!AutoNumericHelper.isNull(options)) {
            this._setSettings(options, true); // We do not call `update` here since this would call `set` too
        }

        return this;
    }

    /**
     * Alias of the `getNumericString()` function.
     * Developers should use one of the more explicit function names to get what they want :
     * - a numeric string : `getNumericString()`
     * - a formatted string : `getFormatted()`
     * - a number : `getNumber()`, or
     * - a localized numeric string : `getLocalized()`
     *
     * @usage anElement.get();
     *
     * @deprecated
     * @returns {string}
     */
    get() {
        return this.getNumericString();
    }

    /**
     * Return the unformatted value as a string.
     *
     * @usage anElement.getNumericString();
     *
     * @returns {string}
     */
    getNumericString() {
        let value = AutoNumericHelper.getElementValue(this.domElement);

        if (this.settings.decimalPlacesShownOnFocus || this.settings.scaleDivisor) {
            value = this.settings.rawValue;
        } else {
            // Test if the value is negative
            const isValueNegative = AutoNumericHelper.isNegative(value);

            if (!(/\d/).test(value) && this.settings.emptyInputBehavior === 'focus') {
                return '';
            }

            if (value !== '' && this.settings.negativeBracketsTypeOnBlur !== null) {
                this.settings.hasFocus = true; //TODO Why do we set the focus information here? That's not logical and should be removed. //FIXME delete this
                value = this.constructor._toggleNegativeBracket(value, this.settings);
            }

            if (this.runOnce || this.settings.formatOnPageLoad === false) {
                // Strips trailing negative symbol
                value = this.constructor._stripAllNonNumberCharacters(value, this.settings, true);
                // Trims leading and trailing zeros when leadingZero does NOT equal "keep".
                value = this._cleanLeadingTrailingZeros(value.replace(this.settings.decimalCharacter, '.'));

                // Places the negative symbol in front of the trailing negative
                if (this.settings.trailingNegative && isValueNegative && !AutoNumericHelper.isNegative(value) && Number(value) !== 0) {
                    value = `-${value}`;
                }
            }

            if (value !== '' || (value === '' && this.settings.emptyInputBehavior === 'zero')) {
                value = this._modifyNegativeSignAndDecimalCharacterForRawValue(value);
            }
        }

        // Always return a numeric string
        // The following statement gets rid of the trailing zeros in the decimal places since the current method does not pad decimals
        return AutoNumericHelper.trimPaddedZerosFromDecimalPlaces(value);
    }

    /**
     * Return the current formatted value of the AutoNumeric element as a string
     *
     * @usage anElement.getFormatted()
     *
     * @returns {string}
     */
    getFormatted() {
        // Make sure `this[0]` exists as well as `.value` before trying to access that property
        if (!('value' in this.domElement || 'textContent' in this.domElement)) {
            AutoNumericHelper.throwError('Unable to get the formatted string from the element.');
        }

        return AutoNumericHelper.getElementValue(this.domElement);
    }

    /**
     * Return the element unformatted value as a real Javascript number.
     * Warning: This can lead to precision problems with big numbers that should be stored as strings.
     *
     * @usage anElement.getNumber()
     *
     * @returns {number}
     */
    getNumber() {
        const value = this.getNumericString();

        return this.constructor._toLocale(value, 'number');
    }

    /**
     * Returns the unformatted value, but following the `outputFormat` setting, which means the output can either be :
     * - a string (that could or could not represent a number (ie. "12345,67-")), or
     * - a plain number (if the setting 'number' is used).
     *
     * By default the returned values are an ISO numeric string "1234.56" or "-1234.56" where the decimal character is a period.
     * Check the "outputFormat" option definition for more details.
     *
     * @usage anElement.getLocalized();
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {*}
     */
    getLocalized(forcedOutputFormat = null) {
        let value;
        if (AutoNumericHelper.isEmptyString(this.settings.rawValue)) {
            value = '';
        } else {
            // Here I use `this.settings.rawValue` instead of `this.getNumericString()` since the current input value could be unformatted with a localization (ie. '1234567,89-').
            // I also convert the rawValue to a number, then back to a string in order to drop the decimal part if the rawValue is an integer.
            value = ''+Number(this.settings.rawValue);
        }

        if (value !== '' && Number(value) === 0 && this.settings.leadingZero !== 'keep') {
            value = '0';
        }

        let outputFormatToUse;
        if (AutoNumericHelper.isNull(forcedOutputFormat)) {
            outputFormatToUse = this.settings.outputFormat;
        } else {
            outputFormatToUse = forcedOutputFormat;
        }

        return this.constructor._toLocale(value, outputFormatToUse);
    }

    /**
     * Force the element to reformat its value again (just in case the formatting has been lost).
     * This can be used right after a form submission for instance (after a previous call to `unformat`).
     *
     * @example anElement.reformat()
     *
     * @returns {AutoNumeric}
     */
    reformat() {
        // `this.settings.rawValue` is used instead of `this.domElement.value` because when the content is `unformatLocalized`, it can become a string that cannot be converted to a number easily
        this.set(this.settings.rawValue);

        return this;
    }

    /**
     * Remove the formatting and keep only the raw unformatted value in the element (as a numericString)
     * Note: this is loosely based on the previous 'unSet()' function
     *
     * By default, values are returned as ISO numeric strings (ie. "1234.56" or "-1234.56"), where the decimal character is a period.
     * @example anElement.unformat()
     *
     * @returns {AutoNumeric}
     */
    unformat() {
        // this.settings.hasFocus = true; //TODO Is this necessary? //FIXME delete this
        AutoNumericHelper.setElementValue(this.domElement, this.getNumericString());

        return this;
    }

    /**
     * Remove the formatting and keep only the localized unformatted value in the element, with the option to override the default outputFormat if needed
     *
     * Locale formats are supported "1234.56-" or "1234,56" or "-1234,56 or "1234,56-", or even plain numbers.
     * Take a look at the `outputFormat` option definition in the default settings for more details.
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {AutoNumeric}
     */
    unformatLocalized(forcedOutputFormat = null) {
        // this.settings.hasFocus = true; //TODO Is this necessary? Can we remove that? //FIXME delete this
        AutoNumericHelper.setElementValue(this.domElement, this.getLocalized(forcedOutputFormat));

        return this;
    }

    /**
     * Return `true` if the current value is the same as when the element got initialized.
     * Note: By default, this returns `true` if the raw unformatted value is still the same even if the formatted one has changed (due to a configuration update for instance).
     * In order to test if the formatted value is the same (which means neither the raw value nor the settings have been changed), then you must pass `false` as its argument.
     *
     * @param {boolean} checkOnlyRawValue If set to `true`, the pristine value is done on the raw unformatted value, not the formatted one.  If set to `false`, this also checks that the formatted value hasn't changed.
     * @returns {boolean}
     */
    isPristine(checkOnlyRawValue = true) {
        let result;
        if (checkOnlyRawValue) {
            result = this.initialValue === this.getNumericString();
        } else {
            result = this.initialValueHtmlAttribute === this.getFormatted();
        }

        return result;
    }

    /**
     * Select the formatted element content, based on the `selectNumberOnly` option
     *
     * @returns {AutoNumeric}
     */
    select() {
        if (this.settings.selectNumberOnly) {
            this.selectNumber();
        } else {
            this._defaultSelectAll();
        }

        return this;
    }

    /**
     * Select the whole element content (including the currency symbol).
     * @private
     */
    _defaultSelectAll() {
        AutoNumericHelper.setElementSelection(this.domElement, 0, AutoNumericHelper.getElementValue(this.domElement).length);
    }

    /**
     * Select only the numbers in the formatted element content, leaving out the currency symbol, whatever the value of the `selectNumberOnly` option
     *
     * @returns {AutoNumeric}
     */
    selectNumber() {
        //TODO Make sure the selection is ok when showPositiveSign is set to `true` (select the negative sign, but not the positive one)
        const unformattedValue = AutoNumericHelper.getElementValue(this.domElement);
        const valueLen = unformattedValue.length;
        const currencySymbolSize = this.settings.currencySymbol.length;
        const currencySymbolPlacement = this.settings.currencySymbolPlacement;
        const negLen = (!AutoNumericHelper.isNegative(unformattedValue))?0:1;
        const suffixTextLen = this.settings.suffixText.length;
        const negativePositiveSignPlacement = this.settings.negativePositiveSignPlacement;

        let start;
        if (currencySymbolPlacement === 's') {
            start = 0;
        } else if (negativePositiveSignPlacement === 'l' && negLen === 1 && currencySymbolSize > 0) {
            start = currencySymbolSize + 1;
        } else {
            start = currencySymbolSize;
        }

        let end;
        if (currencySymbolPlacement === 'p') {
            end = valueLen - suffixTextLen;
        } else {
            switch (negativePositiveSignPlacement) {
                case 'l':
                    end = valueLen - (suffixTextLen + currencySymbolSize);
                    break;
                case 'r':
                    if (currencySymbolSize > 0) {
                        end = valueLen - (currencySymbolSize + negLen + suffixTextLen);
                    } else {
                        end = valueLen - (currencySymbolSize + suffixTextLen);
                    }
                    break;
                default :
                    end = valueLen - (currencySymbolSize + suffixTextLen);
            }
        }

        AutoNumericHelper.setElementSelection(this.domElement, start, end);

        return this;
    }

    /**
     * Select only the integer part in the formatted element content, whatever the value of `selectNumberOnly`
     *
     * @returns {AutoNumeric}
     */
    selectInteger() {
        let start = 0;
        const isPositive = this.settings.rawValue >= 0;

        // Negative or positive sign, if any
        if (this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.prefix ||
            (this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.suffix &&
            (this.settings.negativePositiveSignPlacement === AutoNumeric.options.negativePositiveSignPlacement.prefix ||
            this.settings.negativePositiveSignPlacement === AutoNumeric.options.negativePositiveSignPlacement.none))) {
            if ((this.settings.showPositiveSign && isPositive) ||  // This only exclude the positive sign from being selected
                (!isPositive && this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.prefix && this.settings.negativePositiveSignPlacement === AutoNumeric.options.negativePositiveSignPlacement.left)) { // And this exclude the negative sign from being selected in this special case : '-€ 1.234,57suffixText'
                start = start + 1;
            }
        }

        // Currency symbol
        if (this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.prefix) {
            start = start + this.settings.currencySymbol.length;
        }

        // Calculate the selection end position
        const elementValue = AutoNumericHelper.getElementValue(this.domElement);
        let end = elementValue.indexOf(this.settings.decimalCharacter);
        if (end === -1) {
            // No decimal character found
            if (this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.suffix) {
                end = elementValue.length - this.settings.currencySymbol.length;
            } else {
                end = elementValue.length;
            }

            // Trailing negative sign
            if (!isPositive &&
                (this.settings.negativePositiveSignPlacement === AutoNumeric.options.negativePositiveSignPlacement.suffix ||
                this.settings.currencySymbolPlacement === AutoNumeric.options.currencySymbolPlacement.suffix)) {
                end = end - 1;
            }

            // Avoid selecting the suffix test
            end = end - this.settings.suffixText.length;
        }

        AutoNumericHelper.setElementSelection(this.domElement, start, end);

        return this;
    }

    /**
     * Select only the decimal part in the formatted element content, whatever the value of `selectNumberOnly`
     * Multiple cases are possible :
     * +1.234,57suffixText
     *
     * € +1.234,57suffixText
     * +€ 1.234,57suffixText
     * € 1.234,57+suffixText
     *
     * 1.234,57+ €suffixText
     * 1.234,57 €+suffixText
     * +1.234,57 €suffixText
     *
     * @returns {AutoNumeric}
     */
    selectDecimal() {
        let start = AutoNumericHelper.getElementValue(this.domElement).indexOf(this.settings.decimalCharacter);
        let end;

        if (start === -1) {
            // The decimal character has not been found, we deselect all
            start = 0;
            end = 0;
        } else {
            // A decimal character has been found
            start = start + 1; // We add 1 to exclude the decimal character

            let decimalCount;
            if (this.settings.decimalPlacesShownOnFocus !== null) {
                decimalCount = this.settings.decimalPlacesShownOnFocus;
            } else {
                decimalCount = this.settings.decimalPlacesOverride;
            }

            end = start + decimalCount;
        }

        AutoNumericHelper.setElementSelection(this.domElement, start, end);

        return this;
    }

    /**
     * Return the DOM element reference of the autoNumeric-managed element
     *
     * @returns {HTMLElement|HTMLInputElement}
     */
    node() {
        return this.domElement;
    }

    /**
     * Return the DOM element reference of the parent node of the autoNumeric-managed element
     *
     * @returns {HTMLElement|HTMLInputElement|Node}
     */
    parent() {
        return this.domElement.parentNode;
    }

    /**
     * Detach the current AutoNumeric element from the shared local 'init' list.
     * This means any changes made on that local shared list will not be transmitted to that element anymore.
     * Note : The user can provide another AutoNumeric element, and detach this one instead of the current one.
     *
     * @param {AutoNumeric} otherAnElement
     * @returns {AutoNumeric}
     */
    detach(otherAnElement = null) { //FIXME à tester
        let domElementToDetach;
        if (!AutoNumericHelper.isNull(otherAnElement)) {
            domElementToDetach = otherAnElement.node();
        } else {
            domElementToDetach = this.domElement;
        }

        this._removeFromLocalList(domElementToDetach); //FIXME What happens if the selected dom element does not exist in the list?

        return this;
    }

    /**
     * Attach the given AutoNumeric element to the shared local 'init' list.
     * When doing that, by default the DOM content is left untouched.
     * The user can force a reformat with the new shared list options by passing a second argument to `true`.
     *
     * @param {AutoNumeric} otherAnElement
     * @param {boolean} reFormat
     * @returns {AutoNumeric}
     */
    attach(otherAnElement, reFormat = true) { //FIXME à tester
        this._addToLocalList(otherAnElement.node()); //FIXME Should we make sure the element is not already in the list?
        if (reFormat) {
            otherAnElement.update(this.settings);
        }

        return this;
    }

    /**
     * Format and return the given value, or set the formatted value into the given DOM element if one is passed as an argument.
     * By default, this use the current element settings.
     * The user can override any option of its choosing by passing an option object.
     *
     * @param {number|HTMLElement|HTMLInputElement} valueOrElement
     * @param {null|object} optionOverride
     * @returns {string|null}
     */
    formatOther(valueOrElement, optionOverride = null) { //FIXME à tester
        return this._formatOrUnformatOther(true, valueOrElement, optionOverride);
    }

    /**
     * Unformat and return the raw numeric string corresponding to the given value, or directly set the unformatted value into the given DOM element if one is passed as an argument.
     * By default, this use the current element settings.
     * The user can override any option of its choosing by passing an option object.

     * @param {string|HTMLElement|HTMLInputElement} stringOrElement
     * @param {null|object} optionOverride
     * @returns {string|null}
     */
    unformatOther(stringOrElement, optionOverride = null) { //FIXME à tester
        return this._formatOrUnformatOther(false, stringOrElement, optionOverride);
    }

    /**
     * Method that either format or unformat the value of another element.
     *
     * - Format and return the given value, or set the formatted value into the given DOM element if one is passed as an argument.
     * - Unformat and return the raw numeric string corresponding to the given value, or directly set the unformatted value into the given DOM element if one is passed as an argument.
     *
     * By default, this use the current element settings.
     * The user can override any option of its choosing by passing an option object.
     *
     * @param {boolean} isFormatting If set to `true`, then the method formats, otherwise if set to `false`, it unformats
     * @param {number|string|HTMLElement|HTMLInputElement} valueOrStringOrElement
     * @param {null|object} optionOverride
     * @returns {string|null}
     * @private
     */
    _formatOrUnformatOther(isFormatting, valueOrStringOrElement, optionOverride = null) { //FIXME à tester
        // If the user wants to override the current element settings temporarily
        let settingsToUse;
        if (!AutoNumericHelper.isNull(optionOverride)) {
            settingsToUse = this._cloneAndMergeSettings(optionOverride);
        } else {
            settingsToUse = this.settings;
        }

        // Then the unformatting is done...
        let result;
        if (AutoNumericHelper.isElement(valueOrStringOrElement)) {
            // ...either directly on the DOM element value
            const elementValue = AutoNumericHelper.getElementValue(valueOrStringOrElement);
            if (isFormatting) {
                result = AutoNumeric.format(elementValue, settingsToUse);
            }
            else {
                result = AutoNumeric.unformat(elementValue, settingsToUse);
            }
            AutoNumericHelper.setElementValue(valueOrStringOrElement, result); //TODO Use `unformatAndSet` and `formatAndSet`instead

            return null;
        }

        // ...or on the given value
        if (isFormatting) {
            result = AutoNumeric.format(valueOrStringOrElement, settingsToUse);
        }
        else {
            result = AutoNumeric.unformat(valueOrStringOrElement, settingsToUse);
        }

        return result;
    }

    /**
     * Use the current AutoNumeric element settings to initialize the DOM element given as a parameter.
     * Doing so will *link* the two AutoNumeric elements since they will share the same local AutoNumeric element list.
     * (cf. prototype pattern : https://en.wikipedia.org/wiki/Prototype_pattern)
     *
     * Use case : Once you have an AutoNumeric element already setup correctly with the right options, you can use it as many times you want to initialize as many other DOM elements as needed.
     * Note : this works only on elements that can be managed by autoNumeric.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @param {boolean} detached If set to `true`, then the newly generated AutoNumeric element will not share the same local element list
     * @returns {AutoNumeric}
     */
    init(domElement, detached = false) {
        // Initialize the new AutoNumeric element
        //TODO Use a special call that would prevent calling `_createLocalList` (since we'll delete that list just after if detached == false)
        const newAutoNumericElement =  new AutoNumeric(domElement, AutoNumericHelper.getElementValue(domElement), this.settings);

        // Set the common shared local list if needed
        // If the user wants to create a detached new AutoNumeric element, then skip the following step that bind the two elements together by default
        if (!detached) {
            // 1) Remove the local list created during initialization
            newAutoNumericElement._deleteLocalList();

            // 2) Set the local list reference to point to the initializer's one
            newAutoNumericElement._setLocalList(this._getLocalList());

            // 3) Add the new element to that existing list
            newAutoNumericElement._addToLocalList(domElement); // Here we use the new AutoNumeric object reference to add to the local list, since we'll need the reference to `this` in the methods to points to that new AutoNumeric object.
        }

        return newAutoNumericElement;
    }

    /**
     * Reset the element value either to the empty string '', or the currency sign, depending on the `emptyInputBehavior` option value.
     * If you set the `forceClearAll` argument to `true`, then the `emptyInputBehavior` option is overridden and the whole input is clear, including any currency sign.
     *
     * @param {boolean} forceClearAll
     * @returns {AutoNumeric}
     */
    clear(forceClearAll = false) { //FIXME à tester
        if (forceClearAll) {
            const temporaryForcedOptions = {
                emptyInputBehavior: AutoNumeric.options.emptyInputBehavior.focus,
            };
            this.set('', temporaryForcedOptions);
        } else {
            this.set('');
        }

        return this;
    }

    /**
     * Remove the autoNumeric data and event listeners from the element, but keep the element content intact.
     * This also clears the value from sessionStorage (or cookie, depending on browser supports).
     * Note: this does not remove the formatting.
     *
     * @example anElement.remove()
     */
    remove() {
        this._saveValueToPersistentStorage('remove');
        this._removeEventListeners(); //FIXME à tester

        // Also remove the element from the local AutoNumeric list
        this._removeFromLocalList(this.domElement); //FIXME à tester
        // Also remove the element from the global AutoNumeric list
        this.constructor._removeFromGlobalList(this); //FIXME à tester
    }

    /**
     * Remove the autoNumeric data and event listeners from the element, and reset its value to the empty string ''.
     * This also clears the value from sessionStorage (or cookie, depending on browser supports).
     *
     * @example anElement.wipe()
     */
    wipe() {
        AutoNumericHelper.setElementValue(this.domElement, '');
        this.remove();
    }

    /**
     * Remove the autoNumeric data and event listeners from the element, and delete the DOM element altogether
     */
    nuke() {
        this.remove();
        // Remove the element from the DOM
        this.domElement.parentNode.removeChild(this.domElement);
    }


    // Special functions that really work on the parent <form> element, instead of the <input> element itself

    /**
     * Return a reference to the parent <form> element if it exists, otherwise return `null`
     *
     * @returns {HTMLFormElement|null}
     */
    form() {
        if (this.domElement.tagName.toLowerCase() === 'body') {
            return null;
        }

        let node = this.domElement;
        let tagName;
        do {
            node = node.parentNode;
            tagName = node.tagName.toLowerCase();

            if (tagName === 'body') {
                break;
            }
        } while (tagName !== 'form');

        if (tagName === 'form') {
            return node;
        } else {
            return null;
        }
    }

    /**
     * Return a string in standard URL-encoded notation with the form input values being unformatted.
     * This string can be used as a query for instance.
     *
     * @returns {string}
     */
    formNumericString() {
        return this.constructor._serializeNumericString(this.form(), this.settings.serializeSpaces);
    }

    /**
     * Return a string in standard URL-encoded notation with the form input values being formatted.
     *
     * @returns {string}
     */
    formFormatted() {
        return this.constructor._serializeFormatted(this.form(), this.settings.serializeSpaces);
    }

    /**
     * Return a string in standard URL-encoded notation with the form input values, with localized values.
     * The default output format can be overridden by passing the option as a parameter.
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {string}
     */
    formLocalized(forcedOutputFormat = null) {
        let outputFormatToUse;
        if (AutoNumericHelper.isNull(forcedOutputFormat)) {
            outputFormatToUse = this.settings.outputFormat;
        } else {
            outputFormatToUse = forcedOutputFormat;
        }

        return this.constructor._serializeLocalized(this.form(), this.settings.serializeSpaces, outputFormatToUse);
    }

    /**
     * Return an array containing an object for each form <input> element.
     * Those objects are of the following structure `{ name: foo, value: '42' }`, where the `name` is the DOM element name, and the `value` is an unformatted numeric string.
     *
     * @returns {Array}
     */
    formArrayNumericString() {
        return this.constructor._serializeNumericStringArray(this.form(), this.settings.serializeSpaces);
    }

    /**
     * Return an array containing an object for each form <input> element.
     * Those objects are of the following structure `{ name: foo, value: '42' }`, where the `name` is the DOM element name, and the `value` is the formatted string.
     *
     * @returns {Array}
     */
    formArrayFormatted() {
        return this.constructor._serializeFormattedArray(this.form(), this.settings.serializeSpaces);
    }

    /**
     * Return an array containing an object for each form <input> element.
     * Those objects are of the following structure `{ name: foo, value: '42' }`, where the `name` is the DOM element name, and the `value` is the localized numeric string.
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {Array}
     */
    formArrayLocalized(forcedOutputFormat = null) {
        let outputFormatToUse;
        if (AutoNumericHelper.isNull(forcedOutputFormat)) {
            outputFormatToUse = this.settings.outputFormat;
        } else {
            outputFormatToUse = forcedOutputFormat;
        }

        return this.constructor._serializeLocalizedArray(this.form(), this.settings.serializeSpaces, outputFormatToUse);
    }

    /**
     * Return a JSON string containing an object representing the form input values.
     * This is based on the result of the `formArrayNumericString()` function.
     *
     * @returns {string}
     */
    formJsonNumericString() {
        return JSON.stringify(this.formArrayNumericString());
    }

    /**
     * Return a JSON string containing an object representing the form input values.
     * This is based on the result of the `formArrayFormatted()` function.
     *
     * @returns {string}
     */
    formJsonFormatted() {
        return JSON.stringify(this.formArrayFormatted());
    }

    /**
     * Return a JSON string containing an object representing the form input values.
     * This is based on the result of the `formArrayLocalized()` function.
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {string}
     */
    formJsonLocalized(forcedOutputFormat = null) {
        return JSON.stringify(this.formArrayLocalized(forcedOutputFormat));
    }

    /**
     * Unformat all the autoNumeric-managed elements that are a child of the parent <form> element of this DOM element, to numeric strings
     *
     * @returns {AutoNumeric}
     */
    formUnformat() { //FIXME à tester
        const inputs = this.constructor._getChildANInputElement(this.form());
        inputs.forEach(input => {
            AutoNumeric.getAutoNumericElement(input).unformat();
        });

        return this;
    }

    /**
     * Unformat all the autoNumeric-managed elements that are a child of the parent <form> element of this DOM element, to localized strings
     *
     * @returns {AutoNumeric}
     */
    formUnformatLocalized() { //FIXME à tester
        const inputs = this.constructor._getChildANInputElement(this.form());
        inputs.forEach(input => {
            AutoNumeric.getAutoNumericElement(input).unformatLocalized();
        });

        return this;
    }

    /**
     * Reformat all the autoNumeric-managed elements that are a child of the parent <form> element of this DOM element
     *
     * @returns {AutoNumeric}
     */
    formReformat() { //FIXME à tester
        const inputs = this.constructor._getChildANInputElement(this.form());
        inputs.forEach(input => {
            AutoNumeric.getAutoNumericElement(input).reformat();
        });

        return this;
    }

    /**
     * Convert the input values to numeric strings, submit the form, then reformat those back.
     * The function can either take a callback, or not. If it doesn't, the default `form.submit()` function will be called.
     * Otherwise, it runs `callback(value)` with `value` being equal to the result of `formNumericString()`.
     *
     * @param {function|null} callback
     * @returns {AutoNumeric}
     */
    formSubmitNumericString(callback = null) { //FIXME à tester
        if (AutoNumericHelper.isNull(callback)) {
            this.formUnformat();
            this.form().submit();
            this.formReformat();
        } else if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formNumericString());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Submit the form with the current formatted values.
     * The function can either take a callback, or not. If it doesn't, the default `form.submit()` function will be called.
     * Otherwise, it runs `callback(value)` with `value` being equal to the result of `formFormatted()`.
     *
     * @param {function|null} callback
     * @returns {AutoNumeric}
     */
    formSubmitFormatted(callback = null) { //FIXME à tester
        if (AutoNumericHelper.isNull(callback)) {
            this.form().submit();
        } else if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formFormatted());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Convert the input values to localized strings, submit the form, then reformat those back.
     * The function can either take a callback, or not. If it doesn't, the default `form.submit()` function will be called.
     * Otherwise, it runs `callback(value)` with `value` being equal to the result of `formLocalized()`.
     *
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @param {function|null} callback
     * @returns {AutoNumeric}
     */
    formSubmitLocalized(forcedOutputFormat = null, callback = null) { //FIXME à tester
        if (AutoNumericHelper.isNull(callback)) {
            this.formUnformatLocalized();
            this.form().submit();
            this.formReformat();
        } else if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formLocalized(forcedOutputFormat));
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate an array of numeric strings from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formArrayNumericString()`.
     *
     * @param {function} callback
     * @returns {AutoNumeric}
     */
    formSubmitArrayNumericString(callback) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formArrayNumericString());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate an array of the current formatted values from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formArrayFormatted()`.
     *
     * @param {function} callback
     * @returns {AutoNumeric}
     */
    formSubmitArrayFormatted(callback) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formArrayFormatted());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate an array of localized strings from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formArrayLocalized()`.
     *
     * @param {function} callback
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {AutoNumeric}
     */
    formSubmitArrayLocalized(callback, forcedOutputFormat = null) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formArrayLocalized(forcedOutputFormat));
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate a JSON string with the numeric strings values from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formJsonNumericString()`.
     *
     * @param {function} callback
     * @returns {AutoNumeric}
     */
    formSubmitJsonNumericString(callback) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formJsonNumericString());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate a JSON string with the current formatted values from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formJsonFormatted()`.
     *
     * @param {function} callback
     * @returns {AutoNumeric}
     */
    formSubmitJsonFormatted(callback) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formJsonFormatted());
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Generate a JSON string with the localized strings values from the `<input>` elements, and pass it to the given callback.
     * Under the hood, the array is generated via a call to `formJsonLocalized()`.
     *
     * @param {function} callback
     * @param {null|string} forcedOutputFormat If set to something different than `null`, then this is used as an overriding outputFormat option
     * @returns {AutoNumeric}
     */
    formSubmitJsonLocalized(callback, forcedOutputFormat = null) { //FIXME à tester
        if (AutoNumericHelper.isFunction(callback)) {
            callback(this.formJsonLocalized(forcedOutputFormat));
        } else {
            AutoNumericHelper.throwError(`The given callback is not a function.`);
        }

        return this;
    }

    /**
     * Unformat the given AutoNumeric element, and update the `hoveredWithAlt` variable.
     *
     * @param {AutoNumeric} anElement
     * @private
     */
    static _unformatAltHovered(anElement) {
        anElement.hoveredWithAlt = true;
        anElement.unformat();
    }

    /**
     * Reformat the given AutoNumeric element, and update the `hoveredWithAlt` variable.
     *
     * @param {AutoNumeric} anElement
     * @private
     */
    static _reformatAltHovered(anElement) {
        anElement.hoveredWithAlt = false;
        anElement.reformat();
    }

    /**
     * Return an array of autoNumeric elements, child of the <form> element passed as a parameter.
     *
     * @param {HTMLElement} formNode
     * @returns {Array}
     * @private
     */
    static _getChildANInputElement(formNode) { //FIXME à tester
        const inputList = formNode.getElementsByTagName('input');

        // Loop this list and keep only the inputs that are managed by AutoNumeric
        const autoNumericInputs = [];
        const inputElements = Array.prototype.slice.call(inputList, 0);
        inputElements.forEach(input => {
            if (this.test(input)) {
                autoNumericInputs.push(input);
            }
        });

        return autoNumericInputs;
    }

    // Static methods
    /**
     * Test if the given domElement is already managed by AutoNumeric (if it has been initialized on the current page).
     *
     * @param {HTMLElement} domElement
     * @returns {boolean}
     */
    static test(domElement) { //FIXME à tester
        return this._isInGlobalList(domElement);
    }

    /**
     * Create a WeakMap with the given name.
     *
     * @param {string} weakMapName
     * @private
     */
    static _createWeakMap(weakMapName) {
        window[weakMapName] = new WeakMap();
    }

    /**
     * Create a list of all the AutoNumeric elements that are initialized on the current page.
     * This is needed in order to determine if a given dom element is already managed by autoNumeric.
     * This uses a WeakMap in order to limit potential garbage collection problems.
     * (cf. my tests on http://codepen.io/AnotherLinuxUser/pen/pRQGaM?editors=1011)
     * @private
     */
    static _createGlobalList() {
        // The check that this global list does not exists already is done in the add and remove functions already
        this.autoNumericGlobalListName = 'autoNumericGlobalList'; //XXX This looks weird to set a variable on `this.` in a static method, but that really declare that variable like a static property
        // Note: I should not get any memory leaks for referencing the DOM element in the `value`, this DOM element also being the `key`, according to the spec : http://www.ecma-international.org/ecma-262/6.0/#sec-weakmap-objects
        this._createWeakMap(this.autoNumericGlobalListName);
    }

    /**
     * Return `true` if the global AutoNumeric element list exists.
     *
     * @returns {boolean}
     * @private
     */
    static _doesGlobalListExists() {
        const type = typeof window[this.autoNumericGlobalListName];
        return type !== 'undefined' &&
               type === 'object';
    }

    /**
     * Add the given object to the global AutoNumeric element list.
     *
     * @param {AutoNumeric} autoNumericObject
     * @private
     */
    static _addToGlobalList(autoNumericObject) {
        if (!this._doesGlobalListExists()) {
            this._createGlobalList();
        }

        const domElement = autoNumericObject.node();
        // This checks if the object is not already in the global list before adding it.
        // This could happen if an AutoNumeric element is initialized, then the DOM element is removed directly via `removeChild` (hence the reference does not get removed from the global list), then it get recreated and initialized again
        if (this._isInGlobalList(domElement)) {
            if (this._getFromGlobalList(domElement) === this) {
                // Do not add this AutoNumeric object again since it's already in that global list
                return;
            } else {
                // Print a warning to warn that the domElement already has a reference in the global map (but we cannot for sure starts deleting those old references since they could still be used by another AutoNumeric object)
                AutoNumericHelper.warning(`A reference to the DOM element you just initialized already exists in the global AutoNumeric element list. Please make sure to not initialize the same DOM element multiple times.`);
            }
        }

        window[this.autoNumericGlobalListName].set(domElement, autoNumericObject);
    }

    /**
     * Remove the given object from the global AutoNumeric element list.
     *
     * @param {AutoNumeric} autoNumericObject
     * @private
     */
    static _removeFromGlobalList(autoNumericObject) { //FIXME à tester
        if (this._doesGlobalListExists()) {
            window[this.autoNumericGlobalListName].delete(autoNumericObject.node());
        }
    }

    /**
     * Return the value associated to the key `domElement` passed as a parameter.
     * The value is the AutoNumeric object that manages the DOM element `domElement`.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @returns {null|AutoNumeric}
     * @private
     */
    static _getFromGlobalList(domElement) { //FIXME à tester
        // console.log(`_getFromGlobalList`, this._doesGlobalListExists(), this.autoNumericGlobalListName, window[this.autoNumericGlobalListName].get(domElement)); //DEBUG
        if (this._doesGlobalListExists()) {
            return window[this.autoNumericGlobalListName].get(domElement);
        }

        return null;
    }

    /**
     * Check if the given DOM element is in the global AutoNumeric element list.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @returns {boolean}
     * @private
     */
    static _isInGlobalList(domElement) { //FIXME à tester
        if (!this._doesGlobalListExists()) {
            return false;
        }

        return window[this.autoNumericGlobalListName].has(domElement);
    }

    /**
     * Create a `Map` that will stores all the autoNumeric elements that are initialized from this current element.
     * @private
     */
    _createLocalList() {
        this.autoNumericLocalList = new Map();
        this._addToLocalList(this.domElement);
    }

    /**
     * In some rare cases, you could want to delete the local list generated during the element initialization (in order to use another one instead for instance).
     * @private
     */
    _deleteLocalList() {
        delete this.autoNumericLocalList;
        //TODO Manage the side effects if this list is undefined (what if we later try to access/modify it?)
    }

    _setLocalList(localList) {
        this.autoNumericLocalList = localList;
    }

    _getLocalList() {
        return this.autoNumericLocalList;
    }

    /**
     * Add the given object to the local autoNumeric element list.
     * Note: in order to keep a coherent list, we only add DOM elements in it, not the autoNumeric object.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @param {AutoNumeric} autoNumericObject A reference to the AutoNumeric object that manage the given DOM element
     * @throws
     * @private
     */
    _addToLocalList(domElement, autoNumericObject = null) {
        if (AutoNumericHelper.isNull(autoNumericObject)) {
            autoNumericObject = this;
        }

        if (!AutoNumericHelper.isUndefined(this.autoNumericLocalList)) {
            this.autoNumericLocalList.set(domElement, autoNumericObject); // Use the DOM element as key, and the AutoNumeric object as the value
        } else {
            AutoNumericHelper.throwError(`The local list provided does not exists. [${this.autoNumericLocalList}] given.`);
        }
    }

    /**
     * Remove the given object from the local autoNumeric element list.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @private
     */
    _removeFromLocalList(domElement) {
        if (!AutoNumericHelper.isUndefined(this.autoNumericLocalList)) {
            this.autoNumericLocalList.delete(domElement);
        } else {
            AutoNumericHelper.throwError(`The local list provided does not exists. [${this.autoNumericLocalList}] given.`);
        }
    }

    /**
     * Merge the `newSettings` given as parameters into the current element settings.
     *
     * WARNING: Using `Object.assign()` here means the merge is not recursive and only one depth is merged.
     * cf. http://stackoverflow.com/a/39188108/2834898
     * cf. tests on http://codepen.io/AnotherLinuxUser/pen/KaJORq?editors=0011
     *
     * @param {object} newSettings
     * @private
     */
    _mergeSettings(...newSettings) {
        Object.assign(this.settings, ...newSettings);
    }

    /**
     * Return a new object with the current element settings merged with the new settings.
     *
     * @param {object} newSettings
     * @returns {object}
     * @private
     */
    _cloneAndMergeSettings(...newSettings) {
        const result = {};
        Object.assign(result, this.settings, ...newSettings);

        return result;
    }

    // Throw if the `options` are not valid
    /**
     * Validate the given option object.
     * If the options are valid, this function returns nothing, otherwise if the options are invalid, this function throws an error.
     *
     * This tests if the options are not conflicting and are well formatted.
     * This function is lenient since it only tests the settings properties ; it ignores any other properties the options object could have.
     *
     * @param {*} userOptions
     * @param {Boolean} shouldExtendDefaultOptions If TRUE, then this function will extends the `userOptions` passed by the user, with the default options.
     * @throws Error
     */
    static validate(userOptions, shouldExtendDefaultOptions = true) {
        if (AutoNumericHelper.isUndefinedOrNullOrEmpty(userOptions) || !AutoNumericHelper.isObject(userOptions) || AutoNumericHelper.isEmptyObj(userOptions)) {
            AutoNumericHelper.throwError(`The userOptions are invalid ; it should be a valid object, [${userOptions}] given.`);
        }

        // If the user used old options, we convert them to new ones
        if (!AutoNumericHelper.isNull(userOptions)) {
            this._convertOldOptionsToNewOnes(userOptions);
        }

        // The user can choose if the `userOptions` has already been extended with the default options, or not
        let options;
        if (shouldExtendDefaultOptions) {
            options = Object.assign({}, this.getDefaultConfig(), userOptions);
        } else {
            options = userOptions;
        }

        // First things first, we test that the `showWarnings` option is valid
        if (!AutoNumericHelper.isTrueOrFalseString(options.showWarnings) && !AutoNumericHelper.isBoolean(options.showWarnings)) {
            AutoNumericHelper.throwError(`The debug option 'showWarnings' is invalid ; it should be either 'false' or 'true', [${options.showWarnings}] given.`);
        }

        // Define the regular expressions needed for the following tests
        const testPositiveInteger = /^[0-9]+$/;
        const testNumericalCharacters = /[0-9]+/;
        // const testFloatAndPossibleNegativeSign = /^-?[0-9]+(\.?[0-9]+)$/;
        const testFloatOrIntegerAndPossibleNegativeSign = /^-?[0-9]+(\.?[0-9]+)?$/;
        const testPositiveFloatOrInteger = /^[0-9]+(\.?[0-9]+)?$/;

        // Then tests the options individually
        if (!AutoNumericHelper.isInArray(options.digitGroupSeparator, [
            ',',      // Comma
            '.',      // Dot
            ' ',      // Normal space
            '\u2009', // Thin-space
            '\u202f', // Narrow no-break space
            '\u00a0', // No-break space
            '',       // No separator
            "'",      // Apostrophe
            '٬',      // Arabic thousands separator
            '˙',      // Dot above
        ])) {
            AutoNumericHelper.throwError(`The thousand separator character option 'digitGroupSeparator' is invalid ; it should be ',', '.', '٬', '˙', "'", ' ', '\u2009', '\u202f', '\u00a0' or empty (''), [${options.digitGroupSeparator}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.noSeparatorOnFocus) && !AutoNumericHelper.isBoolean(options.noSeparatorOnFocus)) {
            AutoNumericHelper.throwError(`The 'noSeparatorOnFocus' option is invalid ; it should be either 'false' or 'true', [${options.noSeparatorOnFocus}] given.`);
        }

        if (!testPositiveInteger.test(options.digitalGroupSpacing)) {
            AutoNumericHelper.throwError(`The digital grouping for thousand separator option 'digitalGroupSpacing' is invalid ; it should be a positive integer, [${options.digitalGroupSpacing}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.decimalCharacter, [
            ',', // Comma
            '.', // Dot
            '·', // Middle-dot
            '٫', // Arabic decimal separator
            '⎖', // Decimal separator key symbol
        ])) {
            AutoNumericHelper.throwError(`The decimal separator character option 'decimalCharacter' is invalid ; it should be '.', ',', '·', '⎖' or '٫', [${options.decimalCharacter}] given.`);
        }

        // Checks if the decimal and thousand characters are the same
        if (options.decimalCharacter === options.digitGroupSeparator) {
            AutoNumericHelper.throwError(`autoNumeric will not function properly when the decimal character 'decimalCharacter' [${options.decimalCharacter}] and the thousand separator 'digitGroupSeparator' [${options.digitGroupSeparator}] are the same character.`);
        }

        if (!AutoNumericHelper.isNull(options.decimalCharacterAlternative) && !AutoNumericHelper.isString(options.decimalCharacterAlternative)) {
            AutoNumericHelper.throwError(`The alternate decimal separator character option 'decimalCharacterAlternative' is invalid ; it should be a string, [${options.decimalCharacterAlternative}] given.`);
        }

        if (options.currencySymbol !== '' && !AutoNumericHelper.isString(options.currencySymbol)) {
            AutoNumericHelper.throwError(`The currency symbol option 'currencySymbol' is invalid ; it should be a string, [${options.currencySymbol}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.currencySymbolPlacement, [
            'p',
            's',
        ])) {
            AutoNumericHelper.throwError(`The placement of the currency sign option 'currencySymbolPlacement' is invalid ; it should either be 'p' (prefix) or 's' (suffix), [${options.currencySymbolPlacement}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.negativePositiveSignPlacement, [
            'p',
            's',
            'l',
            'r',
            null,
        ])) {
            AutoNumericHelper.throwError(`The placement of the negative sign option 'negativePositiveSignPlacement' is invalid ; it should either be 'p' (prefix), 's' (suffix), 'l' (left), 'r' (right) or 'null', [${options.negativePositiveSignPlacement}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.showPositiveSign) && !AutoNumericHelper.isBoolean(options.showPositiveSign)) {
            AutoNumericHelper.throwError(`The show positive sign option 'showPositiveSign' is invalid ; it should be either 'false' or 'true', [${options.showPositiveSign}] given.`);
        }

        if (!AutoNumericHelper.isString(options.suffixText) || (options.suffixText !== '' && (AutoNumericHelper.isNegative(options.suffixText) || testNumericalCharacters.test(options.suffixText)))) {
            AutoNumericHelper.throwError(`The additional suffix option 'suffixText' is invalid ; it should not contains the negative sign '-' nor any numerical characters, [${options.suffixText}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.overrideMinMaxLimits) && !AutoNumericHelper.isInArray(options.overrideMinMaxLimits, ['ceiling', 'floor', 'ignore'])) {
            AutoNumericHelper.throwError(`The override min & max limits option 'overrideMinMaxLimits' is invalid ; it should either be 'ceiling', 'floor' or 'ignore', [${options.overrideMinMaxLimits}] given.`);
        }

        if (!AutoNumericHelper.isString(options.maximumValue) || !testFloatOrIntegerAndPossibleNegativeSign.test(options.maximumValue)) {
            AutoNumericHelper.throwError(`The maximum possible value option 'maximumValue' is invalid ; it should be a string that represents a positive or negative number, [${options.maximumValue}] given.`);
        }

        if (!AutoNumericHelper.isString(options.minimumValue) || !testFloatOrIntegerAndPossibleNegativeSign.test(options.minimumValue)) {
            AutoNumericHelper.throwError(`The minimum possible value option 'minimumValue' is invalid ; it should be a string that represents a positive or negative number, [${options.minimumValue}] given.`);
        }

        if (parseFloat(options.minimumValue) > parseFloat(options.maximumValue)) {
            AutoNumericHelper.throwError(`The minimum possible value option is greater than the maximum possible value option ; 'minimumValue' [${options.minimumValue}] should be smaller than 'maximumValue' [${options.maximumValue}].`);
        }

        if (!(AutoNumericHelper.isNull(options.decimalPlacesOverride) ||
            (AutoNumericHelper.isInt(options.decimalPlacesOverride) && options.decimalPlacesOverride >= 0) || // If integer option
            (AutoNumericHelper.isString(options.decimalPlacesOverride) && testPositiveInteger.test(options.decimalPlacesOverride)))  // If string option
        ) {
            AutoNumericHelper.throwError(`The maximum number of decimal places option 'decimalPlacesOverride' is invalid ; it should be a positive integer, [${options.decimalPlacesOverride}] given.`);
        }

        // Write a warning message in the console if the number of decimal in minimumValue/maximumValue is overridden by decimalPlacesOverride (and not if decimalPlacesOverride is equal to the number of decimal used in minimumValue/maximumValue)
        const vMinAndVMaxMaximumDecimalPlaces = this._maximumVMinAndVMaxDecimalLength(options.minimumValue, options.maximumValue);
        if (!AutoNumericHelper.isNull(options.decimalPlacesOverride) && vMinAndVMaxMaximumDecimalPlaces !== Number(options.decimalPlacesOverride)) {
            AutoNumericHelper.warning(`Setting 'decimalPlacesOverride' to [${options.decimalPlacesOverride}] will override the decimals declared in 'minimumValue' [${options.minimumValue}] and 'maximumValue' [${options.maximumValue}].`, options.showWarnings);
        }

        if (!options.allowDecimalPadding && !AutoNumericHelper.isNull(options.decimalPlacesOverride)) {
            AutoNumericHelper.warning(`Setting 'allowDecimalPadding' to [false] will override the current 'decimalPlacesOverride' setting [${options.decimalPlacesOverride}].`, options.showWarnings);
        }

        if (!AutoNumericHelper.isNull(options.decimalPlacesShownOnFocus) && (!AutoNumericHelper.isString(options.decimalPlacesShownOnFocus) || !testPositiveInteger.test(options.decimalPlacesShownOnFocus))) {
            AutoNumericHelper.throwError(`The number of expanded decimal places option 'decimalPlacesShownOnFocus' is invalid ; it should be a positive integer, [${options.decimalPlacesShownOnFocus}] given.`);
        }

        // Checks if the extended decimal places "decimalPlacesShownOnFocus" is greater than the normal decimal places "decimalPlacesOverride"
        if (!AutoNumericHelper.isNull(options.decimalPlacesShownOnFocus) && !AutoNumericHelper.isNull(options.decimalPlacesOverride) && Number(options.decimalPlacesOverride) > Number(options.decimalPlacesShownOnFocus)) {
            AutoNumericHelper.warning(`The extended decimal places 'decimalPlacesShownOnFocus' [${options.decimalPlacesShownOnFocus}] should be greater than the 'decimalPlacesOverride' [${options.decimalPlacesOverride}] value. Currently, this will limit the ability of your client to manually change some of the decimal places. Do you really want to do that?`, options.showWarnings);
        }

        if (!AutoNumericHelper.isNull(options.scaleDivisor) && !testPositiveFloatOrInteger.test(options.scaleDivisor)) {
            AutoNumericHelper.throwError(`The scale divisor option 'scaleDivisor' is invalid ; it should be a positive number, preferably an integer, [${options.scaleDivisor}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.scaleDecimalPlaces) && !testPositiveInteger.test(options.scaleDecimalPlaces)) {
            AutoNumericHelper.throwError(`The scale number of decimals option 'scaleDecimalPlaces' is invalid ; it should be a positive integer, [${options.scaleDecimalPlaces}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.scaleSymbol) && !AutoNumericHelper.isString(options.scaleSymbol)) {
            AutoNumericHelper.throwError(`The scale symbol option 'scaleSymbol' is invalid ; it should be a string, [${options.scaleSymbol}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.saveValueToSessionStorage) && !AutoNumericHelper.isBoolean(options.saveValueToSessionStorage)) {
            AutoNumericHelper.throwError(`The save to session storage option 'saveValueToSessionStorage' is invalid ; it should be either 'false' or 'true', [${options.saveValueToSessionStorage}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.onInvalidPaste, [
            'error',
            'ignore',
            'clamp',
            'truncate',
            'replace',
        ])) {
            AutoNumericHelper.throwError(`The paste behavior option 'onInvalidPaste' is invalid ; it should either be 'error', 'ignore', 'clamp', 'truncate' or 'replace' (cf. documentation), [${options.onInvalidPaste}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.roundingMethod, [
            'S',
            'A',
            's',
            'a',
            'B',
            'U',
            'D',
            'C',
            'F',
            'N05',
            'CHF',
            'U05',
            'D05',
        ])) {
            AutoNumericHelper.throwError(`The rounding method option 'roundingMethod' is invalid ; it should either be 'S', 'A', 's', 'a', 'B', 'U', 'D', 'C', 'F', 'N05', 'CHF', 'U05' or 'D05' (cf. documentation), [${options.roundingMethod}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.allowDecimalPadding) && !AutoNumericHelper.isBoolean(options.allowDecimalPadding)) {
            AutoNumericHelper.throwError(`The control decimal padding option 'allowDecimalPadding' is invalid ; it should be either 'false' or 'true', [${options.allowDecimalPadding}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.negativeBracketsTypeOnBlur) && !AutoNumericHelper.isInArray(options.negativeBracketsTypeOnBlur, [
            '(,)',
            '[,]',
            '<,>',
            '{,}',
            //TODO Add the following brackets :
            // '〈,〉'
            // '｢,｣'
            // '⸤,⸥'
            // '⟦,⟧'
            // '‹,›'
            // '«,»'
        ])) {
            AutoNumericHelper.throwError(`The brackets for negative values option 'negativeBracketsTypeOnBlur' is invalid ; it should either be '(,)', '[,]', '<,>' or '{,}', [${options.negativeBracketsTypeOnBlur}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.emptyInputBehavior, ['focus', 'press', 'always', 'zero'])) {
            AutoNumericHelper.throwError(`The display on empty string option 'emptyInputBehavior' is invalid ; it should either be 'focus', 'press', 'always' or 'zero', [${options.emptyInputBehavior}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.leadingZero, ['allow', 'deny', 'keep'])) {
            AutoNumericHelper.throwError(`The leading zero behavior option 'leadingZero' is invalid ; it should either be 'allow', 'deny' or 'keep', [${options.leadingZero}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.formatOnPageLoad) && !AutoNumericHelper.isBoolean(options.formatOnPageLoad)) {
            AutoNumericHelper.throwError(`The format on initialization option 'formatOnPageLoad' is invalid ; it should be either 'false' or 'true', [${options.formatOnPageLoad}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.selectNumberOnly) && !AutoNumericHelper.isBoolean(options.selectNumberOnly)) {
            AutoNumericHelper.throwError(`The select number only option 'selectNumberOnly' is invalid ; it should be either 'false' or 'true', [${options.selectNumberOnly}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.defaultValueOverride) && (options.defaultValueOverride !== '' && !testFloatOrIntegerAndPossibleNegativeSign.test(options.defaultValueOverride))) {
            AutoNumericHelper.throwError(`The unformatted default value option 'defaultValueOverride' is invalid ; it should be a string that represents a positive or negative number, [${options.defaultValueOverride}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.unformatOnSubmit) && !AutoNumericHelper.isBoolean(options.unformatOnSubmit)) {
            AutoNumericHelper.throwError(`The remove formatting on submit option 'unformatOnSubmit' is invalid ; it should be either 'false' or 'true', [${options.unformatOnSubmit}] given.`);
        }

        if (!AutoNumericHelper.isNull(options.outputFormat) && !AutoNumericHelper.isInArray(options.outputFormat, [
            'string',
            'number',
            '.',
            '-.',
            ',',
            '-,',
            '.-',
            ',-',
        ])) {
            AutoNumericHelper.throwError(`The custom locale format option 'outputFormat' is invalid ; it should either be null, 'string', 'number', '.', '-.', ',', '-,', '.-' or ',-', [${options.outputFormat}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.isCancellable) && !AutoNumericHelper.isBoolean(options.isCancellable)) {
            AutoNumericHelper.throwError(`The cancellable behavior option 'isCancellable' is invalid ; it should be either 'false' or 'true', [${options.isCancellable}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.modifyValueOnWheel) && !AutoNumericHelper.isBoolean(options.modifyValueOnWheel)) {
            AutoNumericHelper.throwError(`The increment/decrement on mouse wheel option 'modifyValueOnWheel' is invalid ; it should be either 'false' or 'true', [${options.modifyValueOnWheel}] given.`);
        }

        if (!(AutoNumericHelper.isString(options.wheelStep) || AutoNumericHelper.isNumber(options.wheelStep)) ||
            (options.wheelStep !== 'progressive' && !testPositiveFloatOrInteger.test(options.wheelStep)) ||
            Number(options.wheelStep) === 0) {
            // We do not accept a step equal to '0'
            AutoNumericHelper.throwError(`The wheel step value option 'wheelStep' is invalid ; it should either be the string 'progressive', or a number or a string that represents a positive number, [${options.wheelStep}] given.`);
        }

        if (!AutoNumericHelper.isInArray(options.serializeSpaces, [
            '+',
            '%20',
        ])) {
            AutoNumericHelper.throwError(`The space replacement character option 'serializeSpaces' is invalid ; it should either be '+' or '%20', [${options.serializeSpaces}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.noEventListeners) && !AutoNumericHelper.isBoolean(options.noEventListeners)) {
            AutoNumericHelper.throwError(`The option 'noEventListeners' that prevent the creation of event listeners is invalid ; it should be either 'false' or 'true', [${options.noEventListeners}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.readOnly) && !AutoNumericHelper.isBoolean(options.readOnly)) {
            AutoNumericHelper.throwError(`The option 'readOnly' is invalid ; it should be either 'false' or 'true', [${options.readOnly}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.unformatOnHover) && !AutoNumericHelper.isBoolean(options.unformatOnHover)) {
            AutoNumericHelper.throwError(`The option 'unformatOnHover' is invalid ; it should be either 'false' or 'true', [${options.unformatOnHover}] given.`);
        }

        if (!AutoNumericHelper.isTrueOrFalseString(options.failOnUnknownOption) && !AutoNumericHelper.isBoolean(options.failOnUnknownOption)) {
            AutoNumericHelper.throwError(`The debug option 'failOnUnknownOption' is invalid ; it should be either 'false' or 'true', [${options.failOnUnknownOption}] given.`);
        }
    }

    /**
     * Return `true` is the settings/options are valid, `false` otherwise.
     *
     * @param {object} options
     * @returns {boolean}
     */
    static areSettingsValid(options) { //FIXME à tester
        let isValid = true;
        try {
            this.validate(options);
        }
        catch (error) {
            isValid = false;
        }

        return isValid;
    }

    /**
     * Return the default autoNumeric settings.
     *
     * @returns {object}
     */
    static getDefaultConfig() {
        return AutoNumeric.defaultSettings;
    }

    /**
     * Return all the predefined language options in one object.
     * You can also access a specific language object directly by using `AutoNumeric.getLanguages().French` for instance.
     *
     * @returns {object}
     */
    static getLanguages() {
        return AutoNumeric.languageOptions;
    }

    /**
     * Format the given number (or numeric string) with the given options. This returns the formatted value as a string.
     * This can also format the give DOM element value with the given options and returns the formatted value as a string.
     * Note : This function does update that element value with the newly formatted value in the process.
     *
     * @param {number|string|HTMLElement|HTMLInputElement} valueOrDomElement A number, or a string that represent a javascript number, or a DOM element
     * @param {object|null} options
     * @returns {string|null}
     */
    static format(valueOrDomElement, options = null) { //FIXME à tester
        if (AutoNumericHelper.isUndefined(valueOrDomElement) || valueOrDomElement === null) {
            return null;
        }

        if (!AutoNumericHelper.isString(valueOrDomElement) && !AutoNumericHelper.isNumber(valueOrDomElement)) {
            AutoNumericHelper.throwError(`The value "${valueOrDomElement}" being "set" is not numeric and therefore cannot be used appropriately.`);
        }

        // Initiate a very basic settings object
        const settings = Object.assign({}, this.getDefaultConfig(), { strip: false }, options);
        if (valueOrDomElement < 0) {
            settings.negativeSignCharacter = '-';
        }

        if (AutoNumericHelper.isNull(settings.decimalPlacesOverride)) {
            settings.decimalPlacesOverride = this._maximumVMinAndVMaxDecimalLength(settings.minimumValue, settings.maximumValue);
        }

        // Check the validity of the `valueOrDomElement` parameter
        // Convert the valueOrDomElement to a numeric string, stripping unnecessary characters in the process
        let valueString = this._toNumericValue(valueOrDomElement, settings);
        if (isNaN(Number(valueString))) {
            AutoNumericHelper.throwError(`The value [${valueString}] that you are trying to format is not a recognized number.`);
        }

        // Basic tests to check if the given valueString is valid
        const [minTest, maxTest] = this._checkIfInRangeWithOverrideOption(valueString, settings);
        if (!minTest || !maxTest) {
            // Throw a custom event
            AutoNumericHelper.triggerEvent('autoFormat.autoNumeric', document, `Range test failed`);
            AutoNumericHelper.throwError(`The value [${valueString}] being set falls outside of the minimumValue [${settings.minimumValue}] and maximumValue [${settings.maximumValue}] range set for this element`);
        }

        // Everything is ok, proceed to rounding, formatting and grouping
        valueString = this._roundValue(valueString, settings);
        valueString = this._modifyNegativeSignAndDecimalCharacterForFormattedValue(valueString, settings);
        valueString = this._addGroupSeparators(valueString, settings);

        return valueString;
    }

    /**
     * Format the given DOM element value, and set the resulting value back as the element value.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @param {object} options
     * @returns {string|null}
     */
    static formatAndSet(domElement, options = null) { //FIXME à tester
        const formattedValue = this.format(domElement, options);
        AutoNumericHelper.setElementValue(domElement, formattedValue);

        return formattedValue;
    }

    /**
     * Unformat the given formatted string with the given options. This returns a numeric string.
     * It can also unformat the given DOM element value with the given options and returns the unformatted numeric string.
     * Note: This does *not* update that element value.
     * This basically allows to get the unformatted value without first having to initialize an AutoNumeric object.
     *
     * @param {string|number|HTMLElement|HTMLInputElement} numericStringOrDomElement
     * @param {object} options
     * @returns {*}
     */
    static unformat(numericStringOrDomElement, options = null) { //FIXME à tester
        let value;
        if (AutoNumericHelper.isElement(numericStringOrDomElement)) {
            value = AutoNumericHelper.getElementValue(numericStringOrDomElement);
        } else {
            value = numericStringOrDomElement;
        }

        if (AutoNumericHelper.isUndefined(value) || value === null) {
            return null;
        }

        // Giving an unformatted value should return the same unformatted value, whatever the options passed as a parameter
        if (AutoNumericHelper.isNumber(value)) {
            return Number(value);
        }

        if (AutoNumericHelper.isArray(value) || AutoNumericHelper.isObject(value)) { //TODO Complete the test to throw when given a wrongly formatted number (ie. 'foobar')
            // Check the validity of the `value` parameter
            AutoNumericHelper.throwError(`A number or a string representing a number is needed to be able to unformat it, [${value}] given.`);
        }

        const settings = Object.assign({}, this.getDefaultConfig(), { strip: false }, options);
        const allowed = `-0123456789\\${settings.decimalCharacter}`;
        const autoStrip = new RegExp(`[^${allowed}]`, 'gi');
        value = value.toString();

        // This checks is a negative sign is anywhere in the `value`, not just on the very first character (ie. '12345.67-')
        if (AutoNumericHelper.isNegative(value)) {
            settings.negativeSignCharacter = '-';
        } else if (settings.negativeBracketsTypeOnBlur && settings.negativeBracketsTypeOnBlur.split(',')[0] === value.charAt(0)) {
            settings.negativeSignCharacter = '-';
            settings.hasFocus = true; //TODO Why do we set the focus information here? That's not logical and should be removed. //FIXME delete this
            value = this._toggleNegativeBracket(value, settings);
        }

        value = value.replace(autoStrip, '');
        value = value.replace(settings.decimalCharacter, '.');
        value = this._toLocale(value, settings.outputFormat);

        return value;
    }

    /**
     * Unformat the given DOM element value, and set the resulting value back as the element value.
     *
     * @param {HTMLElement|HTMLInputElement} domElement
     * @param {object} options
     * @returns {*}
     */
    static unformatAndSet(domElement, options = null) { //FIXME à tester
        const unformattedValue = this.unformat(domElement, options);
        AutoNumericHelper.setElementValue(domElement, unformattedValue);

        return unformattedValue;
    }

    /**
     * Unformat and localize the given formatted string with the given options. This returns a numeric string.
     * It can also unformat and localize the given DOM element value with the given options and returns the unformatted numeric string.
     * Note: This does *not* update that element value.
     * This basically allows to get the localized value without first having to initialize an AutoNumeric object.
     *
     * @param {string|number|HTMLElement|HTMLInputElement} numericStringOrDomElement
     * @param {object} options
     * @returns {*}
     */
    static localize(numericStringOrDomElement, options = null) {
        let value;
        if (AutoNumericHelper.isElement(numericStringOrDomElement)) {
            value = AutoNumericHelper.getElementValue(numericStringOrDomElement);
        } else {
            value = numericStringOrDomElement;
        }

        if (AutoNumericHelper.isNull(options)) {
            options = AutoNumeric.defaultSettings;
        }

        value = this.unformat(value, options);

        //XXX The following code is pretty close to the one you can find in `getLocalized()`, but different enough so we won't refactor it.
        if (Number(value) === 0 && options.leadingZero !== 'keep') {
            value = '0';
        }

        let outputFormatToUse;
        if (AutoNumericHelper.isNull(options)) {
            outputFormatToUse = options.outputFormat;
        } else {
            outputFormatToUse = AutoNumeric.defaultSettings.outputFormat;
        }

        return this._toLocale(value, outputFormatToUse);
    }

    static localizeAndSet(domElement, options = null) { //FIXME à tester
        const localizedValue = this.localize(domElement, options);
        AutoNumericHelper.setElementValue(domElement, localizedValue);

        return localizedValue;
    }

    /**
     * Return `true` is the given DOM element has an AutoNumeric object that manages it.
     *
     * @param {HTMLElement} domElement
     * @returns {boolean}
     */
    static isManagedByAutoNumeric(domElement) { //FIXME à tester
        return this._isInGlobalList(domElement);
    }

    /**
     * Return the AutoNumeric object that manages the given DOM element.
     *
     * @param {HTMLElement} domElement
     * @returns {null|AutoNumeric}
     */
    static getAutoNumericElement(domElement) { //FIXME à tester
        if (!this.isManagedByAutoNumeric(domElement)) {
            return null;
        }

        return this._getFromGlobalList(domElement);
    }


    // Pre-defined options can be called to update the current default options with their specificities
    //XXX A better way would be to not initialize first, but that's not possible since `new` is called first and we do not pass the language options (ie. `French`) to the constructor

    /**
     * Update the AutoNumeric object with the predefined language options, and possibly some option overrides.
     *
     * @param {object} predefinedLanguageOption
     * @param {object} optionOverride
     * @private
     * @returns {AutoNumeric}
     */
    _updateLanguage(predefinedLanguageOption, optionOverride = null) {
        if (!AutoNumericHelper.isNull(optionOverride)) {
            this._mergeSettings(predefinedLanguageOption, optionOverride);
            this.update(this.settings);
        } else {
            this.update(predefinedLanguageOption);
        }

        return this;
    }

    /**
     * Update the settings to use the French pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    french(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().French, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the North American pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    northAmerican(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().NorthAmerican, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the British pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    british(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().British, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the Swiss pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    swiss(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().Swiss, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the Japanese pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    japanese(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().Japanese, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the Spanish pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    spanish(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().Spanish, optionOverride);

        return this;
    }

    /**
     * Update the settings to use the Chinese pre-defined language options.
     * Those pre-defined options can be overridden by passing an option object as a parameter.
     *
     * @param {object} optionOverride
     * @returns {AutoNumeric}
     */
    chinese(optionOverride = null) {
        this._updateLanguage(AutoNumeric.getLanguages().Chinese, optionOverride);

        return this;
    }



    // Internal private functions
    /**
     * Run any callbacks found in the settings object in order to set the settings value back.
     * Any parameter can have a callback defined.
     * The callback takes the current AutoNumeric element as the first argument, and the key name as the second.
     * @example callback(this, 'currencySymbol')
     */
    _runCallbacksFoundInTheSettingsObject() { //FIXME à tester
        // Loops through the this.settings object (option array) to find the following
        for (const key in this.settings) {
            if (this.settings.hasOwnProperty(key)) {
                const value = this.settings[key];

                if (typeof value === 'function') {
                    this.settings[key] = value(this, key);
                } else {
                    // Calls the attached function from the html5 data. For instance: <tag data-currency-symbol="functionName"></tag>
                    let htmlAttribute = this.domElement.getAttribute(key); //TODO Use `dataset` instead of `getAttribute` when we won't need to support obsolete browsers
                    htmlAttribute = AutoNumericHelper.camelize(htmlAttribute);
                    if (typeof this.settings[htmlAttribute] === 'function') {
                        this.settings[key] = htmlAttribute(this, key);
                    }
                }
            }
        }
    }

    /**
     * Determine the maximum decimal length from the minimumValue and maximumValue settings
     *
     * @param {string} minimumValue
     * @param {string} maximumValue
     * @returns {number}
     */
    static _maximumVMinAndVMaxDecimalLength(minimumValue, maximumValue) {
        return Math.max(AutoNumericHelper.decimalPlaces(minimumValue), AutoNumericHelper.decimalPlaces(maximumValue));
    }

    /**
     * Strip all unwanted non-number characters.
     * This keeps the numbers, the negative sign as well as the custom decimal character.
     *
     * @param {string} s
     * @param {object} settings
     * @param {boolean} leftOrAll
     * @returns {string|*}
     */
    static _stripAllNonNumberCharacters(s, settings, leftOrAll) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        //TODO This function is called 10 times (sic!) on each key input, couldn't we lower that number? cf. issue #325
        //TODO Refactor this with `convertToNumericString()` if possible?
        s = String(s); // Typecast to to a string, in case that the initialValue is a number

        if (settings.currencySymbol !== '') {
            // Remove currency sign
            s = s.replace(settings.currencySymbol, '');
        }
        if (settings.suffixText) {
            // Remove suffix
            while (AutoNumericHelper.contains(s, settings.suffixText)) {
                s = s.replace(settings.suffixText, '');
            }
        }

        // First replace anything before digits
        s = s.replace(settings.skipFirstAutoStrip, '$1$2');

        if ((settings.negativePositiveSignPlacement === 's' ||
            (settings.currencySymbolPlacement === 's' && settings.negativePositiveSignPlacement !== 'p')) &&
            AutoNumericHelper.isNegative(s) &&
            s !== '') {
            settings.trailingNegative = true;
        }

        // Then replace anything after digits
        s = s.replace(settings.skipLastAutoStrip, '$1');

        // Then remove any uninteresting characters
        s = s.replace(settings.allowedAutoStrip, '');
        if (settings.decimalCharacterAlternative) {
            s = s.replace(settings.decimalCharacterAlternative, settings.decimalCharacter);
        }

        // Get only number string
        const m = s.match(settings.numRegAutoStrip);
        s = m ? [m[1], m[2], m[3]].join('') : '';

        if (settings.leadingZero === 'allow' || settings.leadingZero === 'keep') {
            let nSign = '';
            const [integerPart, decimalPart] = s.split(settings.decimalCharacter);
            let modifiedIntegerPart = integerPart;
            if (AutoNumericHelper.contains(modifiedIntegerPart, settings.negativeSignCharacter)) {
                nSign = settings.negativeSignCharacter;
                modifiedIntegerPart = modifiedIntegerPart.replace(settings.negativeSignCharacter, '');
            }

            // Strip leading zero on positive value if need
            if (nSign === '' && modifiedIntegerPart.length > settings.mIntPos && modifiedIntegerPart.charAt(0) === '0') {
                modifiedIntegerPart = modifiedIntegerPart.slice(1);
            }

            // Strip leading zero on negative value if need
            if (nSign !== '' && modifiedIntegerPart.length > settings.mIntNeg && modifiedIntegerPart.charAt(0) === '0') {
                modifiedIntegerPart = modifiedIntegerPart.slice(1);
            }

            s = `${nSign}${modifiedIntegerPart}${AutoNumericHelper.isUndefined(decimalPart)?'':settings.decimalCharacter + decimalPart}`;
        }

        if ((leftOrAll && settings.leadingZero === 'deny') ||
            (!settings.hasFocus && settings.leadingZero === 'allow')) {
            s = s.replace(settings.stripReg, '$1$2');
        }

        return s;
    }

    /**
     * Sets or removes brackets on negative values, depending on the focus state.
     * The focus state is 'stored' in the settings object under the `settings.hasFocus` attribute.
     * //TODO Use another object to keep track of internal data that are not settings
     *
     * @param {string} s
     * @param {object} settings
     * @returns {*}
     */
    static _toggleNegativeBracket(s, settings) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        if ((settings.currencySymbolPlacement === 'p' && settings.negativePositiveSignPlacement === 'l') ||
            (settings.currencySymbolPlacement === 's' && settings.negativePositiveSignPlacement === 'p')) {
            //TODO Split the first and last bracket only once during the settings initialization
            const [firstBracket, lastBracket] = settings.negativeBracketsTypeOnBlur.split(',');
            if (!settings.hasFocus) {
                // Add brackets
                s = s.replace(settings.negativeSignCharacter, '');
                s = firstBracket + s + lastBracket;
            } else if (settings.hasFocus && s.charAt(0) === firstBracket) {
                // Remove brackets
                //TODO Quid if the negative sign is not on the left, shouldn't we replace the '-' sign at the right place?
                s = s.replace(firstBracket, settings.negativeSignCharacter);
                s = s.replace(lastBracket, '');
            }
        }

        return s;
    }

    /**
     * Return a number as a numeric string that can be typecast to a Number that Javascript will understand.
     *
     * This function return the given string by stripping the currency sign (currencySymbol), the grouping separators (digitalGroupSpacing) and by replacing the decimal character (decimalCharacter) by a dot.
     * Lastly, it also put the negative sign back to its normal position if needed.
     *
     * @param {string} s
     * @param {object} settings
     * @returns {string|void|XML|*}
     */
    static _convertToNumericString(s, settings) {
        // Remove the currency symbol
        s = s.replace(settings.currencySymbol, '');

        // Remove the grouping separators (thousands separators usually)
        s = s.replace(settings.digitGroupSeparator, '');

        // Replace the decimal character by a dot
        if (settings.decimalCharacter !== '.') {
            s = s.replace(settings.decimalCharacter, '.');
        }

        // Move the trailing negative sign to the right position, if any
        if (AutoNumericHelper.isNegative(s) && s.lastIndexOf('-') === s.length - 1) {
            s = s.replace('-', '');
            s = '-' + s;
        }

        // Convert any arabic numbers to latin ones
        const temp = AutoNumericHelper.arabicToLatinNumbers(s, true, false, false);
        if (!isNaN(temp)) {
            s = temp.toString();
        }

        return s;
    }

    /**
     * Converts the ISO numeric string to the locale decimal and minus sign placement.
     * See the "outputFormat" option definition for more details.
     *
     * @param {string|null} value
     * @param {string|null} locale
     * @returns {*}
     */
    static _toLocale(value, locale) {
        if (AutoNumericHelper.isNull(locale) || locale === 'string') {
            return value;
        }

        let result;
        switch (locale) {
            case 'number':
                result = Number(value);
                break;
            case '.-':
                result = AutoNumericHelper.isNegative(value) ? value.replace('-', '') + '-' : value;
                break;
            case ',':
            case '-,':
                result = value.replace('.', ',');
                break;
            case ',-':
                result = value.replace('.', ',');
                result = AutoNumericHelper.isNegative(result) ? result.replace('-', '') + '-' : result;
                break;
            // The default case
            case '.':
            case '-.':
                result = value;
                break;
            default :
                AutoNumericHelper.throwError(`The given outputFormat [${locale}] option is not recognized.`);
        }

        return result;
    }

    /**
     * Modify the negative sign and the decimal character of the given string value to an hyphen (-) and a dot (.) in order to make that value 'typecastable' to a real number.
     *
     * @param {string} s
     * @returns {string}
     */
    _modifyNegativeSignAndDecimalCharacterForRawValue(s) {
        if (this.settings.decimalCharacter !== '.') {
            s = s.replace(this.settings.decimalCharacter, '.');
        }
        if (this.settings.negativeSignCharacter !== '-' && this.settings.negativeSignCharacter !== '') {
            s = s.replace(this.settings.negativeSignCharacter, '-');
        }
        if (!s.match(/\d/)) {
            // The default value returned by `get` is not formatted with decimals
            s += '0';
        }

        return s;
    }

    /**
     * Modify the negative sign and the decimal character to use those defined in the settings.
     *
     * @param {string} s
     * @param {object} settings
     * @returns {string}
     */
    static _modifyNegativeSignAndDecimalCharacterForFormattedValue(s, settings) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        if (settings.negativeSignCharacter !== '-' && settings.negativeSignCharacter !== '') {
            s = s.replace('-', settings.negativeSignCharacter);
        }
        if (settings.decimalCharacter !== '.') {
            s = s.replace('.', settings.decimalCharacter);
        }

        return s;
    }

    /**
     * Private function to check for empty value
     * //TODO Modify this function so that it return either TRUE or FALSE if the value is empty. Then create another function to return the input value if it's not empty.
     *
     * @param {string} inputValue
     * @param {object} settings
     * @param {boolean} signOnEmpty
     * @returns {*}
     */
    static _checkEmpty(inputValue, settings, signOnEmpty) {
        if (inputValue === '' || inputValue === settings.negativeSignCharacter) {
            if (settings.emptyInputBehavior === 'always' || signOnEmpty) {
                return (settings.negativePositiveSignPlacement === 'l') ? inputValue + settings.currencySymbol + settings.suffixText : settings.currencySymbol + inputValue + settings.suffixText;
            }

            return inputValue;
        }

        return null;
    }

    /**
     * Modify the input value by adding the group separators, as defined in the settings.
     *
     * @param {string} inputValue
     * @param {object} settings
     * @returns {*}
     */
    static _addGroupSeparators(inputValue, settings) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        if (settings.strip) {
            inputValue = this._stripAllNonNumberCharacters(inputValue, settings, false);
        }

        //TODO This function `addGroupSeparators()` add group separators. Adding the negative sign as well is out of its scope. Move that to another function.
        if (settings.trailingNegative && !AutoNumericHelper.isNegative(inputValue)) {
            inputValue = '-' + inputValue;
        }

        const empty = this._checkEmpty(inputValue, settings, true);
        const isValueNegative = AutoNumericHelper.isNegative(inputValue);
        const isZero = AutoNumericHelper.isZeroOrHasNoValue(inputValue);
        if (isValueNegative) {
            inputValue = inputValue.replace('-', '');
        }

        if (!AutoNumericHelper.isNull(empty)) {
            return empty;
        }

        settings.digitalGroupSpacing = settings.digitalGroupSpacing.toString();
        let digitalGroup;
        switch (settings.digitalGroupSpacing) {
            case '2':
                digitalGroup = /(\d)((\d)(\d{2}?)+)$/;
                break;
            case '2s':
                digitalGroup = /(\d)((?:\d{2}){0,2}\d{3}(?:(?:\d{2}){2}\d{3})*?)$/;
                break;
            case '4':
                digitalGroup = /(\d)((\d{4}?)+)$/;
                break;
            default :
                digitalGroup = /(\d)((\d{3}?)+)$/;
        }

        // Splits the string at the decimal string
        let [integerPart, decimalPart] = inputValue.split(settings.decimalCharacter);
        if (settings.decimalCharacterAlternative && AutoNumericHelper.isUndefined(decimalPart)) {
            [integerPart, decimalPart] = inputValue.split(settings.decimalCharacterAlternative);
        }

        if (settings.digitGroupSeparator !== '') {
            // Re-inserts the thousand separator via a regular expression
            while (digitalGroup.test(integerPart)) {
                integerPart = integerPart.replace(digitalGroup, `$1${settings.digitGroupSeparator}$2`);
            }
        }

        if (settings.decimalPlacesOverride !== 0 && !AutoNumericHelper.isUndefined(decimalPart)) {
            if (decimalPart.length > settings.decimalPlacesOverride) {
                decimalPart = decimalPart.substring(0, settings.decimalPlacesOverride);
            }

            // Joins the whole number with the decimal value
            inputValue = integerPart + settings.decimalCharacter + decimalPart;
        } else {
            // Otherwise if it's an integer
            inputValue = integerPart;
        }

        settings.trailingNegative = false;

        if (settings.currencySymbolPlacement === 'p') {
            if (isValueNegative) {
                switch (settings.negativePositiveSignPlacement) {
                    case 'l':
                        inputValue = `${settings.negativeSignCharacter}${settings.currencySymbol}${inputValue}`;
                        break;
                    case 'r':
                        inputValue = `${settings.currencySymbol}${settings.negativeSignCharacter}${inputValue}`;
                        break;
                    case 's':
                        inputValue = `${settings.currencySymbol}${inputValue}${settings.negativeSignCharacter}`;
                        settings.trailingNegative = true;
                        break;
                    default :
                    //
                }
            } else if (settings.showPositiveSign && !isZero) {
                switch (settings.negativePositiveSignPlacement) {
                    case 'l':
                        inputValue = `${settings.positiveSignCharacter}${settings.currencySymbol}${inputValue}`;
                        break;
                    case 'r':
                        inputValue = `${settings.currencySymbol}${settings.positiveSignCharacter}${inputValue}`;
                        break;
                    case 's':
                        inputValue = `${settings.currencySymbol}${inputValue}${settings.positiveSignCharacter}`;
                        break;
                    default :
                    //
                }
            } else {
                inputValue = settings.currencySymbol + inputValue;
            }
        }

        if (settings.currencySymbolPlacement === 's') {
            if (isValueNegative) {
                switch (settings.negativePositiveSignPlacement) {
                    case 'r':
                        inputValue = `${inputValue}${settings.currencySymbol}${settings.negativeSignCharacter}`;
                        settings.trailingNegative = true;
                        break;
                    case 'l':
                        inputValue = `${inputValue}${settings.negativeSignCharacter}${settings.currencySymbol}`;
                        settings.trailingNegative = true;
                        break;
                    case 'p':
                        inputValue = `${settings.negativeSignCharacter}${inputValue}${settings.currencySymbol}`;
                        break;
                    default :
                    //
                }
            } else if (settings.showPositiveSign && !isZero) {
                switch (settings.negativePositiveSignPlacement) {
                    case 'r':
                        inputValue = `${inputValue}${settings.currencySymbol}${settings.positiveSignCharacter}`;
                        break;
                    case 'l':
                        inputValue = `${inputValue}${settings.positiveSignCharacter}${settings.currencySymbol}`;
                        break;
                    case 'p':
                        inputValue = `${settings.positiveSignCharacter}${inputValue}${settings.currencySymbol}`;
                        break;
                    default :
                    //
                }
            } else {
                inputValue = inputValue + settings.currencySymbol;
            }
        }

        // Removes the negative sign and places brackets
        if (settings.negativeBracketsTypeOnBlur !== null && (settings.rawValue < 0 || AutoNumericHelper.isNegativeStrict(inputValue))) {
            inputValue = this._toggleNegativeBracket(inputValue, settings);
        }

        return inputValue + settings.suffixText;
    }

    /**
     * Truncate not needed zeros
     *
     * @param {string} roundedInputValue
     * @param {int} temporaryDecimalPlacesOverride
     * @returns {void|XML|string|*}
     */
    static _truncateZeros(roundedInputValue, temporaryDecimalPlacesOverride) {
        let regex;
        switch (temporaryDecimalPlacesOverride) {
            case 0:
                // Prevents padding - removes trailing zeros until the first significant digit is encountered
                regex = /(\.(?:\d*[1-9])?)0*$/;
                break;
            case 1:
                // Allows padding when decimalPlacesOverride equals one - leaves one zero trailing the decimal character
                regex = /(\.\d(?:\d*[1-9])?)0*$/;
                break;
            default :
                // Removes access zeros to the decimalPlacesOverride length when allowDecimalPadding is set to true
                regex = new RegExp(`(\\.\\d{${temporaryDecimalPlacesOverride}}(?:\\d*[1-9])?)0*`);
        }

        // If there are no decimal places, we don't need a decimal point at the end
        roundedInputValue = roundedInputValue.replace(regex, '$1');
        if (temporaryDecimalPlacesOverride === 0) {
            roundedInputValue = roundedInputValue.replace(/\.$/, '');
        }

        return roundedInputValue;
    }

    /**
     * Round the input value using the rounding method defined in the settings.
     * This function accepts multiple rounding methods. See the documentation for more details about those.
     *
     * Note : This is handled as text since JavaScript math function can return inaccurate values.
     *
     * @param {string} inputValue
     * @param {object} settings
     * @returns {*}
     */
    static _roundValue(inputValue, settings) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        inputValue = (inputValue === '') ? '0' : inputValue.toString();
        if (settings.roundingMethod === 'N05' || settings.roundingMethod === 'CHF' || settings.roundingMethod === 'U05' || settings.roundingMethod === 'D05') {
            switch (settings.roundingMethod) {
                case 'N05':
                    inputValue = (Math.round(inputValue * 20) / 20).toString();
                    break;
                case 'U05':
                    inputValue = (Math.ceil(inputValue * 20) / 20).toString();
                    break;
                default :
                    inputValue = (Math.floor(inputValue * 20) / 20).toString();
            }

            let result;
            if (!AutoNumericHelper.contains(inputValue, '.')) {
                result = inputValue + '.00';
            } else if (inputValue.length - inputValue.indexOf('.') < 3) {
                result = inputValue + '0';
            } else {
                result = inputValue;
            }
            return result;
        }

        let ivRounded = '';
        let i = 0;
        let nSign = '';
        let temporaryDecimalPlacesOverride;

        // sets the truncate zero method
        if (settings.allowDecimalPadding) {
            temporaryDecimalPlacesOverride = settings.decimalPlacesOverride;
        } else {
            temporaryDecimalPlacesOverride = 0;
        }

        // Checks if the inputValue (input Value) is a negative value
        if (AutoNumericHelper.isNegativeStrict(inputValue)) {
            nSign = '-';

            // Removes the negative sign that will be added back later if required
            inputValue = inputValue.replace('-', '');
        }

        // Append a zero if the first character is not a digit (then it is likely to be a dot)
        if (!inputValue.match(/^\d/)) {
            inputValue = '0' + inputValue;
        }

        // Determines if the value is equal to zero. If it is, remove the negative sign
        if (Number(inputValue) === 0) {
            nSign = '';
        }

        // Trims leading zero's as needed
        if ((Number(inputValue) > 0 && settings.leadingZero !== 'keep') || (inputValue.length > 0 && settings.leadingZero === 'allow')) {
            inputValue = inputValue.replace(/^0*(\d)/, '$1');
        }

        const dPos = inputValue.lastIndexOf('.');
        const inputValueHasADot = dPos === -1;

        // Virtual decimal position
        const vdPos = inputValueHasADot ? inputValue.length - 1 : dPos;

        // Checks decimal places to determine if rounding is required :
        // Check if no rounding is required
        let cDec = (inputValue.length - 1) - vdPos;

        if (cDec <= settings.decimalPlacesOverride) {
            // Check if we need to pad with zeros
            ivRounded = inputValue;
            if (cDec < temporaryDecimalPlacesOverride) {
                if (inputValueHasADot) {
                    ivRounded += settings.decimalCharacter;
                }

                let zeros = '000000';
                while (cDec < temporaryDecimalPlacesOverride) {
                    zeros = zeros.substring(0, temporaryDecimalPlacesOverride - cDec);
                    ivRounded += zeros;
                    cDec += zeros.length;
                }
            } else if (cDec > temporaryDecimalPlacesOverride) {
                ivRounded = this._truncateZeros(ivRounded, temporaryDecimalPlacesOverride);
            } else if (cDec === 0 && temporaryDecimalPlacesOverride === 0) {
                ivRounded = ivRounded.replace(/\.$/, '');
            }

            return (Number(ivRounded) === 0) ? ivRounded : nSign + ivRounded;
        }

        // Rounded length of the string after rounding
        let rLength;
        if (inputValueHasADot) {
            rLength = settings.decimalPlacesOverride - 1;
        } else {
            rLength = settings.decimalPlacesOverride + dPos;
        }

        const tRound = Number(inputValue.charAt(rLength + 1));
        const odd = (inputValue.charAt(rLength) === '.') ? (inputValue.charAt(rLength - 1) % 2) : (inputValue.charAt(rLength) % 2);
        let ivArray = inputValue.substring(0, rLength + 1).split('');

        if ((tRound > 4 && settings.roundingMethod === 'S')                  || // Round half up symmetric
            (tRound > 4 && settings.roundingMethod === 'A' && nSign === '')  || // Round half up asymmetric positive values
            (tRound > 5 && settings.roundingMethod === 'A' && nSign === '-') || // Round half up asymmetric negative values
            (tRound > 5 && settings.roundingMethod === 's')                  || // Round half down symmetric
            (tRound > 5 && settings.roundingMethod === 'a' && nSign === '')  || // Round half down asymmetric positive values
            (tRound > 4 && settings.roundingMethod === 'a' && nSign === '-') || // Round half down asymmetric negative values
            (tRound > 5 && settings.roundingMethod === 'B')                  || // Round half even "Banker's Rounding"
            (tRound === 5 && settings.roundingMethod === 'B' && odd === 1)   || // Round half even "Banker's Rounding"
            (tRound > 0 && settings.roundingMethod === 'C' && nSign === '')  || // Round to ceiling toward positive infinite
            (tRound > 0 && settings.roundingMethod === 'F' && nSign === '-') || // Round to floor toward negative infinite
            (tRound > 0 && settings.roundingMethod === 'U')) {                  // Round up away from zero
            // Round up the last digit if required, and continue until no more 9's are found
            for (i = (ivArray.length - 1); i >= 0; i -= 1) {
                if (ivArray[i] !== '.') {
                    ivArray[i] = +ivArray[i] + 1;
                    if (ivArray[i] < 10) {
                        break;
                    }

                    if (i > 0) {
                        ivArray[i] = '0';
                    }
                }
            }
        }

        // Reconstruct the string, converting any 10's to 0's
        ivArray = ivArray.slice(0, rLength + 1);

        // Return the rounded value
        ivRounded = this._truncateZeros(ivArray.join(''), temporaryDecimalPlacesOverride);

        return (Number(ivRounded) === 0) ? ivRounded : nSign + ivRounded;
    }

    /**
     * Truncates the decimal part of a number.
     *
     * @param {string} s
     * @param {object} settings
     * @param {boolean} isPaste
     * @returns {*}
     */
    static _truncateDecimal(s, settings, isPaste) {
        s = (isPaste) ? this._roundValue(s, settings) : s;

        if (settings.decimalCharacter && settings.decimalPlacesOverride) {
            const [integerPart, decimalPart] = s.split(settings.decimalCharacter);

            // truncate decimal part to satisfying length since we would round it anyway
            if (decimalPart && decimalPart.length > settings.decimalPlacesOverride) {
                if (settings.decimalPlacesOverride > 0) {
                    const modifiedDecimalPart = decimalPart.substring(0, settings.decimalPlacesOverride);
                    s = `${integerPart}${settings.decimalCharacter}${modifiedDecimalPart}`;
                } else {
                    s = integerPart;
                }
            }
        }

        return s;
    }

    /**
     * Check that the number satisfy the format conditions
     * and lays between settings.minimumValue and settings.maximumValue
     * and the string length does not exceed the digits in settings.minimumValue and settings.maximumValue
     *
     * @param {string} s
     * @param {object} settings
     * @returns {*}
     */
    static _checkIfInRangeWithOverrideOption(s, settings) {
        s = s.toString();
        s = s.replace(',', '.');
        const minParse = AutoNumericHelper.parseStr(settings.minimumValue);
        const maxParse = AutoNumericHelper.parseStr(settings.maximumValue);
        const valParse = AutoNumericHelper.parseStr(s);

        let result;
        switch (settings.overrideMinMaxLimits) {
            case 'floor':
                result = [AutoNumericHelper.testMinMax(minParse, valParse) > -1, true];
                break;
            case 'ceiling':
                result = [true, AutoNumericHelper.testMinMax(maxParse, valParse) < 1];
                break;
            case 'ignore':
                result = [true, true];
                break;
            default:
                result = [AutoNumericHelper.testMinMax(minParse, valParse) > -1, AutoNumericHelper.testMinMax(maxParse, valParse) < 1];
        }

        return result;
    }

    /**
     * Original settings saved for use when the `decimalPlacesShownOnFocus` and `noSeparatorOnFocus` options are used.
     * Those original settings are used exclusively in the `focusin` and `focusout` event handlers.
     */
    _keepAnOriginalSettingsCopy() {
        //TODO Move this data to temporary attributes, in order to prevent changing the user settings
        this.settings.originalDecimalPlacesOverride      = this.settings.decimalPlacesOverride;
        this.settings.originalAllowDecimalPadding        = this.settings.allowDecimalPadding;
        this.settings.originalNegativeBracketsTypeOnBlur = this.settings.negativeBracketsTypeOnBlur;
        this.settings.originalDigitGroupSeparator        = this.settings.digitGroupSeparator;
        this.settings.originalCurrencySymbol             = this.settings.currencySymbol;
        this.settings.originalSuffixText                 = this.settings.suffixText;
    }

    /**
     * Original settings saved for use when `decimalPlacesShownOnFocus` & `noSeparatorOnFocus` options are being used.
     * This is taken from Quirksmode.
     *
     * @param {string} name
     * @returns {*}
     */
    static _readCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        let c = '';
        for (let i = 0; i < ca.length; i += 1) {
            c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }

        return null;
    }

    /**
     * Test if sessionStorage is supported.
     * This is taken from Modernizr.
     *
     * @returns {boolean}
     */
    static _storageTest() {
        const mod = 'modernizr';
        try {
            sessionStorage.setItem(mod, mod);
            sessionStorage.removeItem(mod);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * properly formats the string to a numeric when leadingZero does not 'keep'.
     *
     * @param {string} value
     * @returns {string}
     */
    _cleanLeadingTrailingZeros(value) {
        // Return the empty string is the value is already empty. This prevent converting that value to '0'.
        if (value === '') {
            return '';
        }

        // Return '0' if the value is zero
        if (Number(value) === 0 && this.settings.leadingZero !== 'keep') {
            return '0';
        }

        if (this.settings.leadingZero !== 'keep') {
            // Trim leading zero's - leaves one zero to the left of the decimal point
            value = value.replace(/^(-)?0+(?=\d)/g,'$1');

            //TODO remove this from that function and use `trimPaddedZerosFromDecimalPlaces()` instead. Also create a new `trailingZero` option.
            if (AutoNumericHelper.contains(value, '.')) {
                // Trims trailing zeros after the decimal point
                value = value.replace(/(\.[0-9]*?)0+$/, '$1');
            }
        }
        // Strips trailing decimal point
        value = value.replace(/\.$/, '');

        return value;
    }

    /**
     * Creates or removes sessionStorage or cookie depending on what the browser is supporting.
     *
     * @param {string} action
     * @returns {*}
     */
    _saveValueToPersistentStorage(action) {
        if (this.settings.saveValueToSessionStorage) {
            const storedName = (this.domElement.name !== '' && !AutoNumericHelper.isUndefined(this.domElement.name)) ?`AUTO_${decodeURIComponent(this.domElement.name)}` :`AUTO_${this.domElement.id}`;
            let date;
            let expires;

            // Sets cookie for browser that do not support sessionStorage IE 6 & IE 7
            if (this._storageTest() === false) {
                switch (action) {
                    case 'set':
                        document.cookie = `${storedName}=${this.settings.rawValue}; expires= ; path=/`;
                        break;
                    case 'remove':
                        date = new Date();
                        date.setTime(date.getTime() + (-1 * 24 * 60 * 60 * 1000));
                        expires = '; expires=' + date.toUTCString(); // Note : `toGMTString()` has been deprecated (cf. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toGMTString)
                        document.cookie = `${storedName}='' ;${expires}; path=/`;
                        break;
                    case 'get':
                        return this._readCookie(storedName);
                }
            } else {
                switch (action) {
                    case 'set':
                        sessionStorage.setItem(storedName, this.settings.rawValue);
                        break;
                    case 'remove':
                        sessionStorage.removeItem(storedName);
                        break;
                    case 'get':
                        return sessionStorage.getItem(storedName);
                }
            }
        }
    }

    /**
     * Handler for 'focusin' and 'mouseenter' events
     *
     * @param {Event} e
     */
    _onFocusInAndMouseEnter(e) {
        if (this.settings.unformatOnHover && e.type === 'mouseenter' && e.altKey) {
            this.constructor._unformatAltHovered(this);

            return;
        }

        if (e.type === 'focusin' && this.settings.unformatOnHover && this.hoveredWithAlt) {
            this.constructor._reformatAltHovered(this);
        }

        if (e.type === 'focusin' || e.type === 'mouseenter' && !this.isFocused && this.settings.emptyInputBehavior === 'focus') {
            this.settings.hasFocus = true;

            if (this.settings.negativeBracketsTypeOnBlur !== null && this.settings.negativeSignCharacter !== '') {
                AutoNumericHelper.setElementValue(this.domElement, this.constructor._toggleNegativeBracket(AutoNumericHelper.getElementValue(e.target), this.settings));
            }

            // clean the value to compare to rawValue
            let result = this.constructor._stripAllNonNumberCharacters(AutoNumericHelper.getElementValue(e.target), this.settings, true);
            result = this.constructor._convertToNumericString(result, this.settings);
            result = this._cleanLeadingTrailingZeros(result);
            if (this.settings.trailingNegative) {
                result = '-' + result;
            }

            let updateElementValue = false;
            if (this.settings.decimalPlacesShownOnFocus) {
                this.settings.decimalPlacesOverride = this.settings.decimalPlacesShownOnFocus;
                updateElementValue = true;
            } else if (this.settings.scaleDivisor && this.settings.rawValue !== '') {
                // Prevent changing the element value if it's empty (so we don't end up having a '0.000scaleSymbol' value after a mouseenter/mouseleave cycle)
                this.settings.decimalPlacesOverride = Number(this.settings.originalDecimalPlacesOverride);
                updateElementValue = true;
            } else if (this.settings.noSeparatorOnFocus) {
                this.settings.digitGroupSeparator = '';
                this.settings.currencySymbol = '';
                this.settings.suffixText = '';
                updateElementValue = true;
            } else if (result !== this.settings.rawValue) {
                this.set(result); // This update the rawValue
            }

            if (updateElementValue) {
                const roundedValue = this.constructor._roundValue(this.settings.rawValue, this.settings);
                AutoNumericHelper.setElementValue(this.domElement, this.constructor._addGroupSeparators(roundedValue, this.settings));
            }

            // In order to send a 'native' change event when blurring the input, we need to first store the initial input value on focus.
            this.valueOnFocus = AutoNumericHelper.getElementValue(e.target);
            this.lastVal = this.valueOnFocus;
            const onEmpty = this.constructor._checkEmpty(this.valueOnFocus, this.settings, true);
            if ((onEmpty !== null && onEmpty !== '') && this.settings.emptyInputBehavior === 'focus') {
                AutoNumericHelper.setElementValue(this.domElement, onEmpty);

                // If there is a currency symbol and its on the right hand side, then we place the caret accordingly on the far left side
                if (onEmpty === this.settings.currencySymbol && this.settings.currencySymbolPlacement === 's') {
                    AutoNumericHelper.setElementSelection(e.target, 0);
                }
            } else {
                // Otherwise by default the whole input content is selected on focus (following the `selectNumberOnly` option)
                //XXX Firefox <47 does not respect this selection...Oh well.
                this.select();
            }
        }
    }

    /**
     * Handler for the 'focus' event.
     * We update the info of the focused state in the `this.isFocused` variable when the element gets focused.
     */
    _onFocus() {
        if (this.settings.isCancellable) {
            // Save the current unformatted value for later use by the 'cancellable' feature
            this._saveCancellableValue();
        }

        // We keep track if the element is currently focused
        this.isFocused = true;
    }

    /**
     * Handler for 'keydown' events.
     * The user just started pushing any key, hence one event is sent.
     *
     * Note :
     * By default a 'normal' input output those events in the right order when inputting a character key (ie. 'a') :
     * - keydown
     * - keypress
     * - input
     * - keyup
     *
     * ...when inputting a modifier key (ie. 'ctrl') :
     * - keydown
     * - keyup
     *
     * If 'delete' or 'backspace' is entered, the following events are sent :
     * - keydown
     * - input
     * - keyup
     *
     * If 'enter' is entered and the value has not changed, the following events are sent :
     * - keydown
     * - keypress
     * - keyup
     *
     * If 'enter' is entered and the value has been changed, the following events are sent :
     * - keydown
     * - keypress
     * - change
     * - keyup
     *
     * When a paste is done, the following events are sent :
     * - input (if paste is done with the mouse)
     *
     * - keydown (if paste is done with ctrl+v)
     * - keydown
     * - input
     * - keyup
     * - keyup
     *
     * @param {KeyboardEvent} e
     */
    _onKeydown(e) {
        if (!this.isFocused && this.settings.unformatOnHover && e.altKey && this.domElement === AutoNumericHelper.getHoveredElement()) {
            // Here I prevent calling _unformatAltHovered if the element is already focused, since the global 'keydown' listener will pick it up as well
            this.constructor._unformatAltHovered(this);

            return;
        }

        this._updateEventKeycode(e);
        this.initialValueOnKeydown = AutoNumericHelper.getElementValue(e.target); // This is needed in `onKeyup()` to check if the value as changed during the key press

        if (this.domElement.readOnly) {
            this.processed = true;

            return;
        }

        if (this.eventKeyCode === AutoNumericEnum.keyCode.Esc) {
            //XXX The default 'Escape' key behavior differs between Firefox and Chrome, Firefox already having a built-in 'cancellable-like' feature. This is why we call `e.preventDefault()` here instead of just when `isCancellable` is set to `true`. This allow us to keep the same behavior across browsers.
            e.preventDefault();

            if (this.settings.isCancellable) {
                // If the user wants to cancel its modifications :
                // We set back the saved value
                //TODO Do not set the value again if it has not changed
                this.set(this.savedCancellableValue);
                // And we need to send an 'input' event when setting back the initial value in order to make other scripts aware of the value change...
                AutoNumericHelper.triggerEvent('input', e.target);
            }

            // ..and lastly we update the caret selection, even if the option `isCancellable` is false
            this.select();
        }

        // The "enter" key throws a `change` event if the value has changed since the `focus` event
        let targetValue = AutoNumericHelper.getElementValue(e.target);
        if (this.eventKeyCode === AutoNumericEnum.keyCode.Enter && this.valueOnFocus !== targetValue) {
            AutoNumericHelper.triggerEvent('change', e.target);
            this.valueOnFocus = targetValue;

            if (this.settings.isCancellable) {
                // If the user activated the 'cancellable' feature, we save the validated value when 'Enter' is hit
                this._saveCancellableValue();
            }
        }

        this._updateInternalProperties(e);

        if (this._skipAlways(e)) {
            this.processed = true;

            return;
        }

        // Check if the key is a delete/backspace key
        if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace || this.eventKeyCode === AutoNumericEnum.keyCode.Delete) {
            this._processCharacterDeletion(); // Because backspace and delete only triggers keydown and keyup events, not keypress
            this.processed = true;
            this._formatValue(e);

            // If and only if the resulting value has changed after that backspace/delete, then we have to send an 'input' event like browsers normally do.
            targetValue = AutoNumericHelper.getElementValue(e.target); // Update the value since it could have been changed during the deletion
            if ((targetValue !== this.lastVal) && this.settings.throwInput) {
                // Throw an input event when a character deletion is detected
                AutoNumericHelper.triggerEvent('input', e.target);
                e.preventDefault(); // ...and immediately prevent the browser to delete a second character
            }

            this.lastVal = targetValue;
            this.settings.throwInput = true;

            return;
        }

        this.formatted = false; //TODO Is this line needed? (I mean, _formatValue always set it to `true`, and this overwrite that info)
    }

    /**
     * Handler for 'keypress' events.
     * The user is still pressing the key, which will output a character (ie. '2') continuously until it releases the key.
     * Note: 'keypress' events are not sent for delete keys like Backspace/Delete.
     *
     * @param {KeyboardEvent} e
     */
    _onKeypress(e) {
        // Retrieve the real character that has been entered (ie. 'a' instead of the key code)
        const eventCharacter = AutoNumericHelper.character(e);

        // Firefox generate a 'keypress' event (e.keyCode === 0) for the keys that do not print a character (ie. 'Insert', 'Delete', 'Fn' keys, 'PageUp', 'PageDown' etc.). 'Shift' on the other hand does not generate a keypress event.
        if (eventCharacter === AutoNumericEnum.keyName.Insert) {
            return;
        }

        const processed = this.processed;
        this._updateInternalProperties(e);

        if (this._skipAlways(e)) {
            return;
        }

        if (processed) {
            e.preventDefault();

            return;
        }

        const isCharacterInsertionAllowed = this._processCharacterInsertion(e);
        if (isCharacterInsertionAllowed) {
            this._formatValue(e);
            const targetValue = AutoNumericHelper.getElementValue(e.target);
            if ((targetValue !== this.lastVal) && this.settings.throwInput) {
                // Throws input event on adding a character
                AutoNumericHelper.triggerEvent('input', e.target);
                e.preventDefault(); // ...and immediately prevent the browser to add a second character
            }
            else {
                if ((eventCharacter === this.settings.decimalCharacter || eventCharacter === this.settings.decimalCharacterAlternative) &&
                    (AutoNumericHelper.getElementSelection(e.target).start === AutoNumericHelper.getElementSelection(e.target).end) &&
                    AutoNumericHelper.getElementSelection(e.target).start === targetValue.indexOf(this.settings.decimalCharacter)) {
                    const position = AutoNumericHelper.getElementSelection(e.target).start + 1;
                    AutoNumericHelper.setElementSelection(e.target, position);
                }
                e.preventDefault();
            }

            this.lastVal = AutoNumericHelper.getElementValue(e.target);
            this.settings.throwInput = true;

            return;
        }

        e.preventDefault();

        this.formatted = false; //TODO Is this line needed? (I mean, _formatValue always set it to `true`, and this overwrite that info)
    }

    /**
     * Handler for 'keyup' events.
     * The user just released any key, hence one event is sent.
     *
     * @param {KeyboardEvent} e
     */
    _onKeyup(e) {
        if (this.settings.isCancellable && this.eventKeyCode === AutoNumericEnum.keyCode.Esc) {
            // If the user wants to cancel its modifications, we drop the 'keyup' event for the Esc key
            e.preventDefault();

            return;
        }

        if (AutoNumericHelper.character(e) === AutoNumericEnum.keyName.Alt && this.hoveredWithAlt) {
            this.constructor._reformatAltHovered(this);

            return;
        }

        this._updateInternalProperties(e);

        const skip = this._skipAlways(e);
        delete this.valuePartsBeforePaste;
        const targetValue = AutoNumericHelper.getElementValue(e.target);
        if (skip || targetValue === '') {
            return;
        }

        // Added to properly place the caret when only the currency sign is present
        if (targetValue === this.settings.currencySymbol) {
            if (this.settings.currencySymbolPlacement === 's') {
                AutoNumericHelper.setElementSelection(e.target, 0);
            } else {
                AutoNumericHelper.setElementSelection(e.target, this.settings.currencySymbol.length);
            }
        } else if (this.eventKeyCode === AutoNumericEnum.keyCode.Tab) {
            AutoNumericHelper.setElementSelection(e.target, 0, targetValue.length);
        }

        if ((targetValue === this.settings.suffixText) ||
            (this.settings.rawValue === '' && this.settings.currencySymbol !== '' && this.settings.suffixText !== '')) {
            AutoNumericHelper.setElementSelection(e.target, 0);
        }

        // Saves the extended decimal to preserve the data when navigating away from the page
        if (this.settings.decimalPlacesShownOnFocus !== null && this.settings.saveValueToSessionStorage) {
            this._saveValueToPersistentStorage('set');
        }

        if (!this.formatted) {  //TODO Is this line needed? Considering that onKeydown and onKeypress both finish by setting it to false...
            this._formatValue(e);
        }

        // If the input value has changed during the key press event chain, an event is sent to alert that a formatting has been done (cf. Issue #187)
        if (targetValue !== this.initialValueOnKeydown) {
            //FIXME This event is not sent when pasting valid values
            AutoNumericHelper.triggerEvent('autoNumeric:formatted', e.target);
        }
    }

    /**
     * Handler for 'focusout' events
     *
     * @param {Event} e
     */
    _onFocusOutAndMouseLeave(e) {
        if (this.settings.unformatOnHover && e.type === 'mouseleave' && this.hoveredWithAlt) {
            this.constructor._reformatAltHovered(this);

            return;
        }

        if ((e.type === 'mouseleave' && !this.isFocused) || e.type === 'blur') {
            let value = AutoNumericHelper.getElementValue(e.target);
            const origValue = value;
            this.settings.hasFocus = false;

            if (this.settings.saveValueToSessionStorage) {
                this._saveValueToPersistentStorage('set');
            }

            if (this.settings.noSeparatorOnFocus === true) {
                this.settings.digitGroupSeparator = this.settings.originalDigitGroupSeparator;
                this.settings.currencySymbol = this.settings.originalCurrencySymbol;
                this.settings.suffixText = this.settings.originalSuffixText;
            }

            if (this.settings.decimalPlacesShownOnFocus !== null) {
                this.settings.decimalPlacesOverride = this.settings.originalDecimalPlacesOverride;
                this.settings.allowDecimalPadding = this.settings.originalAllowDecimalPadding;
                this.settings.negativeBracketsTypeOnBlur = this.settings.originalNegativeBracketsTypeOnBlur;
            }

            value = this.constructor._stripAllNonNumberCharacters(value, this.settings, true);

            if (value !== '') {
                if (this.settings.trailingNegative && !AutoNumericHelper.isNegative(value)) {
                    value = '-' + value;
                    this.settings.trailingNegative = false;
                }

                const [minTest, maxTest] = this.constructor._checkIfInRangeWithOverrideOption(value, this.settings);
                if (this.constructor._checkEmpty(value, this.settings, false) === null && minTest && maxTest) {
                    value = this._modifyNegativeSignAndDecimalCharacterForRawValue(value);
                    this.settings.rawValue = this._cleanLeadingTrailingZeros(value);

                    if (this.settings.scaleDivisor) {
                        value = value / this.settings.scaleDivisor;
                        value = value.toString();
                    }

                    this.settings.decimalPlacesOverride = (this.settings.scaleDivisor && this.settings.scaleDecimalPlaces) ? Number(this.settings.scaleDecimalPlaces) : this.settings.decimalPlacesOverride;
                    value = this.constructor._roundValue(value, this.settings);
                    value = this.constructor._modifyNegativeSignAndDecimalCharacterForFormattedValue(value, this.settings);
                } else {
                    if (!minTest) {
                        AutoNumericHelper.triggerEvent('autoNumeric:minExceeded', this.domElement);
                    }
                    if (!maxTest) {
                        AutoNumericHelper.triggerEvent('autoNumeric:maxExceeded', this.domElement);
                    }

                    value = this.settings.rawValue;
                }
            } else {
                if (this.settings.emptyInputBehavior === 'zero') {
                    this.settings.rawValue = '0';
                    value = this.constructor._roundValue('0', this.settings);
                } else {
                    this.settings.rawValue = '';
                }
            }

            let groupedValue = this.constructor._checkEmpty(value, this.settings, false);
            if (groupedValue === null) {
                groupedValue = this.constructor._addGroupSeparators(value, this.settings);
            }

            if (groupedValue !== origValue) {
                if (this.settings.scaleSymbol) {
                    groupedValue = `${groupedValue}${this.settings.scaleSymbol}`;
                }

                AutoNumericHelper.setElementValue(this.domElement, groupedValue);
            }

            if (groupedValue !== this.valueOnFocus) {
                AutoNumericHelper.triggerEvent('change', this.domElement);
                delete this.valueOnFocus;
            }
        }
    }

    /**
     * Handler for 'paste' event
     *
     * @param {Event|ClipboardEvent} e
     */
    _onPaste(e) {
        //TODO Using ctrl+z after a paste should cancel it -> How would that affect other frameworks/component built with that feature in mind though?
        //FIXME When pasting '000' on a thousand group selection, the whole selection gets deleted, and only one '0' is pasted (cf. issue #302)
        // The event is prevented by default, since otherwise the user would be able to paste invalid characters into the input
        e.preventDefault();

        let rawPastedText = e.clipboardData.getData('text/plain');

        // 0. Special case if the user has selected all the input text before pasting
        const initialFormattedValue = AutoNumericHelper.getElementValue(e.target);
        const selectionStart = e.target.selectionStart || 0;
        const selectionEnd = e.target.selectionEnd || 0;
        const selectionSize = selectionEnd - selectionStart;
        let isAllInputTextSelected = false;

        if (selectionSize === initialFormattedValue.length) {
            isAllInputTextSelected = true;
        }

        // 1. Check if the paste has a negative sign (only if it's the first character), and store that information for later use
        const isPasteNegative = AutoNumericHelper.isNegativeStrict(rawPastedText);
        if (isPasteNegative) {
            // 1a. Remove the negative sign from the pasted text
            rawPastedText = rawPastedText.slice(1, rawPastedText.length);
        }

        // 2. Strip all thousand separators, brackets and currency sign, and convert the decimal character to a dot
        const untranslatedPastedText = this._preparePastedText(rawPastedText);

        let pastedText;
        if (untranslatedPastedText === '.') {
            // Special case : If the user tries to paste a single decimal character (that has been translated to '.' already)
            pastedText = '.';
        } else {
            // Normal case
            // Allow pasting arabic numbers
            pastedText = AutoNumericHelper.arabicToLatinNumbers(untranslatedPastedText, false, false, false);
        }

        // 3. Test if the paste is valid (only has numbers and eventually a decimal character). If it's not valid, stop here.
        if (pastedText !== '.' && (!AutoNumericHelper.isNumber(pastedText) || pastedText === '')) {
            if (this.settings.onInvalidPaste === 'error') {
                //TODO Should we send a warning instead of throwing an error?
                AutoNumericHelper.throwError(`The pasted value '${rawPastedText}' is not a valid paste content.`);
            }

            return;
        }

        // 4. Calculate the paste result
        let caretPositionOnInitialTextAfterPasting;
        let initialUnformattedNumber = this.getNumericString();
        let isInitialValueNegative = AutoNumericHelper.isNegativeStrict(initialUnformattedNumber);
        let isPasteNegativeAndInitialValueIsPositive;
        let result;

        // If the pasted content is negative, then the result will be negative too
        if (isPasteNegative && !isInitialValueNegative) {
            initialUnformattedNumber = `-${initialUnformattedNumber}`;
            isInitialValueNegative = true;
            isPasteNegativeAndInitialValueIsPositive = true;
        }
        else {
            isPasteNegativeAndInitialValueIsPositive = false;
        }

        let leftPartContainedADot = false;
        switch (this.settings.onInvalidPaste) {
            /* 4a. Truncate paste behavior:
             * Insert as many numbers as possible on the right hand side of the caret from the pasted text content, until the input reach its range limit.
             * If there is more characters in the clipboard once a limit is reached, drop the extraneous characters.
             * Otherwise paste all the numbers in the clipboard.
             * While doing so, we check if the result is within the minimum and maximum values allowed, and stop as soon as we encounter one of those.
             *
             * 4b. Replace paste behavior:
             * Idem than the 'truncate' paste behavior, except that when a range limit is hit, we try to replace the subsequent initial numbers with the pasted ones, until we hit the range limit a second (and last) time, or we run out of numbers to paste
             */
            /* eslint no-case-declarations: 0 */
            case 'truncate':
            case 'replace':
                const leftFormattedPart = initialFormattedValue.slice(0, selectionStart);
                const rightFormattedPart = initialFormattedValue.slice(selectionEnd, initialFormattedValue.length);

                if (selectionStart !== selectionEnd) {
                    // a. If there is a selection, remove the selected part, and return the left and right part
                    result = this._preparePastedText(leftFormattedPart + rightFormattedPart);
                } else {
                    // b. Else if this is only one caret (and therefore no selection), then return the left and right part
                    result = this._preparePastedText(initialFormattedValue);
                }

                // Add back the negative sign if needed
                if (isInitialValueNegative) {
                    result = AutoNumericHelper.setRawNegativeSign(result);
                }

                // Build the unformatted result string
                caretPositionOnInitialTextAfterPasting = AutoNumericHelper.convertCharacterCountToIndexPosition(AutoNumericHelper.countNumberCharactersOnTheCaretLeftSide(initialFormattedValue, selectionStart, this.settings.decimalCharacter));
                if (isPasteNegativeAndInitialValueIsPositive) {
                    // If the initial paste is negative and the initial value is not, then I must offset the caret position by one place to the right to take the additional hyphen into account
                    caretPositionOnInitialTextAfterPasting++;
                    //TODO Quid if the negative sign is not on the left (negativePositiveSignPlacement and currencySymbolPlacement)?
                }

                let leftPart = result.slice(0, caretPositionOnInitialTextAfterPasting);
                let rightPart = result.slice(caretPositionOnInitialTextAfterPasting, result.length);
                if (pastedText === '.') {
                    if (AutoNumericHelper.contains(leftPart, '.')) {
                        // If I remove a dot here, then I need to update the caret position (decrement it by 1) when positioning it
                        // To do so, we keep that info in order to modify the caret position later
                        leftPartContainedADot = true;
                        leftPart = leftPart.replace('.', '');
                    }
                    rightPart = rightPart.replace('.', '');
                }
                // -- Here, we are good to go to continue on the same basis

                // c. Add numbers one by one at the caret position, while testing if the result is valid and within the range of the minimum and maximum value
                //    Continue until you either run out of numbers to paste, or that you get out of the range limits
                const minParse = AutoNumericHelper.parseStr(this.settings.minimumValue);
                const maxParse = AutoNumericHelper.parseStr(this.settings.maximumValue);
                let lastGoodKnownResult = result; // This is set as the default, in case we do not add even one number
                let pastedTextIndex = 0;
                let modifiedLeftPart = leftPart;

                while (pastedTextIndex < pastedText.length) {
                    // Modify the result with another pasted character
                    modifiedLeftPart += pastedText[pastedTextIndex];
                    result = modifiedLeftPart + rightPart;

                    // Check the range limits
                    if (!this.constructor._checkIfInRange(result, minParse, maxParse)) {
                        // The result is out of the range limits, stop the loop here
                        break;
                    }

                    // Save the last good known result
                    lastGoodKnownResult = result;

                    // Update the local variables for the next loop
                    pastedTextIndex++;
                }

                // Update the last caret position where to insert a new number
                caretPositionOnInitialTextAfterPasting += pastedTextIndex;

                //XXX Here we have the result for the `truncate` option
                if (this.settings.onInvalidPaste === 'truncate') {
                    //TODO If the user as defined a truncate callback and there are still some numbers (that will be dropped), then call this callback with the initial paste as well as the remaining numbers
                    result = lastGoodKnownResult;

                    if (leftPartContainedADot) {
                        // If a dot has been removed for the part on the left of the caret, we decrement the caret index position
                        caretPositionOnInitialTextAfterPasting--;
                    }
                    break;
                }
                //XXX ...else we need to continue modifying the result for the 'replace' option

                // d. Until there are numbers to paste, replace the initial numbers one by one, and still do the range test.
                //    Stop when you have no more numbers to paste, or if you are out of the range limits.
                //    If you do get to the range limits, use the previous known good value within those limits.
                //    Note: The numbers are replaced one by one, in the integer then decimal part, while ignoring the decimal character
                //TODO What should happen if the user try to paste a decimal number? Should we override the current initial decimal character in favor of this new one? If we do, then we have to recalculate the vMin/vMax from the start in order to take into account this new decimal character position..
                let lastGoodKnownResultIndex = caretPositionOnInitialTextAfterPasting;
                const lastGoodKnownResultSize = lastGoodKnownResult.length;

                while (pastedTextIndex < pastedText.length && lastGoodKnownResultIndex < lastGoodKnownResultSize) {
                    if (lastGoodKnownResult[lastGoodKnownResultIndex] === '.') {
                        // We skip the decimal character 'replacement'. That way, we do not change the decimal character position regarding the remaining numbers.
                        lastGoodKnownResultIndex++;
                        continue;
                    }

                    // This replace one character at a time
                    result = AutoNumericHelper.replaceCharAt(lastGoodKnownResult, lastGoodKnownResultIndex, pastedText[pastedTextIndex]);

                    // Check the range limits
                    if (!this.constructor._checkIfInRange(result, minParse, maxParse)) {
                        // The result is out of the range limits, stop the loop here
                        break;
                    }

                    // Save the last good known result
                    lastGoodKnownResult = result;

                    // Update the local variables for the next loop
                    pastedTextIndex++;
                    lastGoodKnownResultIndex++;
                }

                // Update the last caret position where to insert a new number
                caretPositionOnInitialTextAfterPasting = lastGoodKnownResultIndex;

                if (leftPartContainedADot) {
                    // If a dot has been removed for the part on the left of the caret, we decrement the caret index position
                    caretPositionOnInitialTextAfterPasting--;
                }

                result = lastGoodKnownResult;

                break;
            /* 4c. Normal paste behavior:
             * Insert the pasted number inside the current unformatted text, at the right caret position or selection
             */
            case 'error':
            case 'ignore':
            case 'clamp':
            default:
                // 1. Generate the unformatted result
                const leftFormattedPart2 = initialFormattedValue.slice(0, selectionStart);
                const rightFormattedPart2 = initialFormattedValue.slice(selectionEnd, initialFormattedValue.length);

                if (selectionStart !== selectionEnd) {
                    // a. If there is a selection, remove the selected part, and return the left and right part
                    result = this._preparePastedText(leftFormattedPart2 + rightFormattedPart2);
                } else {
                    // b. Else if this is only one caret (and therefore no selection), then return the left and right part
                    result = this._preparePastedText(initialFormattedValue);
                }

                // Add back the negative sign if needed
                if (isInitialValueNegative) {
                    result = AutoNumericHelper.setRawNegativeSign(result);
                }

                // Build the unformatted result string
                caretPositionOnInitialTextAfterPasting = AutoNumericHelper.convertCharacterCountToIndexPosition(AutoNumericHelper.countNumberCharactersOnTheCaretLeftSide(initialFormattedValue, selectionStart, this.settings.decimalCharacter));
                if (isPasteNegativeAndInitialValueIsPositive) {
                    // If the initial paste is negative and the initial value is not, then I must offset the caret position by one place to the right to take the additional hyphen into account
                    caretPositionOnInitialTextAfterPasting++;
                    //TODO Quid if the negative sign is not on the left (negativePositiveSignPlacement and currencySymbolPlacement)?
                }

                leftPart = result.slice(0, caretPositionOnInitialTextAfterPasting);
                rightPart = result.slice(caretPositionOnInitialTextAfterPasting, result.length);
                if (pastedText === '.') {
                    // If the user only paste a single decimal character, then we remove the previously existing one (if any)
                    if (AutoNumericHelper.contains(leftPart, '.')) {
                        // If I remove a dot here, then I need to update the caret position (decrement it by 1) when positioning it
                        // To do so, we keep that info in order to modify the caret position later
                        leftPartContainedADot = true;
                        leftPart = leftPart.replace('.', '');
                    }
                    rightPart = rightPart.replace('.', '');
                }
                // -- Here, we are good to go to continue on the same basis

                // Generate the unformatted result
                result = `${leftPart}${pastedText}${rightPart}`;

                // 2. Calculate the caret position in the unformatted value, for later use
                if (selectionStart === selectionEnd) {
                    // There is no selection, then the caret position is set after the pasted text
                    const indexWherePastedTextHasBeenInserted = AutoNumericHelper.convertCharacterCountToIndexPosition(AutoNumericHelper.countNumberCharactersOnTheCaretLeftSide(initialFormattedValue, selectionStart, this.settings.decimalCharacter));
                    caretPositionOnInitialTextAfterPasting = indexWherePastedTextHasBeenInserted + pastedText.length; // I must not count the characters that have been removed from the pasted text (ie. '.')
                } else {
                    if (isAllInputTextSelected) {
                        // Special case when all the input text is selected before pasting, which means we'll completely erase its content and paste only the clipboard content
                        caretPositionOnInitialTextAfterPasting = result.length;
                    } else if (rightPart === '') {
                        // If the user selected from the caret position to the end of the input (on the far right)
                        caretPositionOnInitialTextAfterPasting = AutoNumericHelper.convertCharacterCountToIndexPosition(AutoNumericHelper.countNumberCharactersOnTheCaretLeftSide(initialFormattedValue, selectionStart, this.settings.decimalCharacter)) + pastedText.length;
                    } else {
                        // Normal case
                        const indexSelectionEndInRawValue = AutoNumericHelper.convertCharacterCountToIndexPosition(AutoNumericHelper.countNumberCharactersOnTheCaretLeftSide(initialFormattedValue, selectionEnd, this.settings.decimalCharacter));

                        // Here I must not count the characters that have been removed from the pasted text (ie. '.'), or the thousand separators in the initial selected text
                        const selectedText = AutoNumericHelper.getElementValue(e.target).slice(selectionStart, selectionEnd);
                        caretPositionOnInitialTextAfterPasting = indexSelectionEndInRawValue - selectionSize + AutoNumericHelper.countCharInText(this.settings.digitGroupSeparator, selectedText) + pastedText.length;
                    }
                }

                // Modify the caret position for special cases, only if the whole input has not been selected
                if (!isAllInputTextSelected) {
                    if (isPasteNegativeAndInitialValueIsPositive) {
                        // If the pasted value has a '-' sign, but the initial value does not, offset the index by one
                        caretPositionOnInitialTextAfterPasting++;
                    }

                    if (leftPartContainedADot) {
                        // If a dot has been removed for the part on the left of the caret, we decrement the caret index position
                        caretPositionOnInitialTextAfterPasting--;
                    }
                }
        }

        // 5. Check if the result is a valid number, if not, drop the paste and do nothing.
        if (!AutoNumericHelper.isNumber(result) || result === '') {
            if (this.settings.onInvalidPaste === 'error') {
                AutoNumericHelper.throwError(`The pasted value '${rawPastedText}' would result into an invalid content '${result}'.`); //TODO Should we send a warning instead of throwing an error?
                //TODO This is not DRY ; refactor with above
            }
            return;
        }

        // 6. If it's a valid number, check if it falls inside the minimum and maximum value. If this fails, modify the value following this procedure :
        /*
         * If 'error' (this is the default) :
         *      - Normal paste behavior.
         *      - Try to set the new value, if it fails, then throw an error in the console.
         *      - Do not change the input value, do not change the current selection.
         * If 'ignore' :
         *      - Normal paste behavior.
         *      - Try to set the new value, if it fails, do nothing more.
         *      - Do not change the input value, do not change the current selection.
         * If 'clamp' :
         *      - Normal paste behavior.
         *      - Try to set the new value, if it fails, set the value to the minimum or maximum limit, whichever is closest to the
         *        paste result.
         *      - Change the caret position to be positioned on the left hand side of the decimal character.
         * If 'truncate' :
         *      - Truncate paste behavior.
         *      - Try to set the new value, until it fails (if the result is out of the min and max value limits).
         *      - Drop the remaining non-pasted numbers, and keep the last known non-failing result.
         *      - Change the caret position to be positioned after the last pasted character.
         * If 'replace' :
         *      - Replace paste behavior.
         *      - Try to set the new value, until it fails (if the result is out of the min and max value limits).
         *     - Then try to replace as many numbers as possible with the pasted ones. Once it fails, keep the last known non-failing result.
         *      - Change the caret position to be positioned after the last pasted character.
         */
        let valueHasBeenSet = false;
        let valueHasBeenClamped = false;
        try {
            this.set(result);
            valueHasBeenSet = true;
        }
        catch (error) {
            let clampedValue;
            switch (this.settings.onInvalidPaste) {
                case 'clamp':
                    clampedValue = AutoNumericHelper.clampToRangeLimits(result, this.settings);
                    try {
                        this.set(clampedValue);
                    }
                    catch (error) {
                        AutoNumericHelper.throwError(`Fatal error: Unable to set the clamped value '${clampedValue}'.`);
                    }

                    valueHasBeenClamped = true;
                    valueHasBeenSet = true;
                    result = clampedValue; // This is used only for setting the caret position later
                    break;
                case 'error':
                case 'truncate':
                case 'replace':
                    // Throw an error message
                    AutoNumericHelper.throwError(`The pasted value '${rawPastedText}' results in a value '${result}' that is outside of the minimum [${this.settings.minimumValue}] and maximum [${this.settings.maximumValue}] value range.`);
                // falls through
                case 'ignore':
                // Do nothing
                // falls through
                default :
                    return; // ...and nothing else should be changed
            }
        }

        // 7. Then lastly, set the caret position at the right logical place
        const targetValue = AutoNumericHelper.getElementValue(e.target);
        let caretPositionInFormattedNumber;
        if (valueHasBeenSet) {
            switch (this.settings.onInvalidPaste) {
                case 'clamp':
                    if (valueHasBeenClamped) {
                        if (this.settings.currencySymbolPlacement === 's') {
                            AutoNumericHelper.setElementSelection(e.target, targetValue.length - this.settings.currencySymbol.length); // This puts the caret on the right of the last decimal place
                        } else {
                            AutoNumericHelper.setElementSelection(e.target, targetValue.length); // ..and this on the far right
                        }

                        break;
                    } // else if the value has not been clamped, the default behavior is used...
                // falls through
                case 'error':
                case 'ignore':
                case 'truncate':
                case 'replace':
                default :
                    // Whenever one or multiple characters are pasted, this means we have to manage the potential thousand separators that could be added by the formatting
                    caretPositionInFormattedNumber = AutoNumericHelper.findCaretPositionInFormattedNumber(result, caretPositionOnInitialTextAfterPasting, targetValue, this.settings.decimalCharacter);
                    AutoNumericHelper.setElementSelection(e.target, caretPositionInFormattedNumber);
            }
        }

        // 8. We make sure we send an input event only if the result is different than the initial value before the paste
        if (valueHasBeenSet && initialFormattedValue !== targetValue) {
            // On a 'normal' non-autoNumeric input, an `input` event is sent when a paste is done. We mimic that.
            AutoNumericHelper.triggerEvent('input', e.target);
        }
    }

    /**
     * When focusing out of the input, we check if the value has changed, and if it has, then we send a `change` event (since the native one would have been prevented by `e.preventDefault()` called in the other event listeners).
     * We also update the info of the focused state in the `this.isFocused` variable.
     *
     * @param {Event} e
     */
    _onBlur(e) {
        if (AutoNumericHelper.getElementValue(e.target) !== this.valueOnFocus) {
            AutoNumericHelper.triggerEvent('change', e.target);
        }

        // We keep track if the element is currently focused
        this.isFocused = false;
    }

    /**
     * Handler for 'wheel' event
     *
     * @param {WheelEvent} e
     */
    _onWheel(e) {
        // If the user is using the 'Shift' key modifier, then we ignore the wheel event
        // This special behavior is applied in order to avoid preventing the user to scroll the page if the inputs are covering the whole available space.
        // If that's the case, then he can use the 'Shift' modifier key while using the mouse wheel in order to bypass the increment/decrement feature
        // This is useful on small screen where some badly configured inputs could use all the available space.
        if (!e.shiftKey && this.settings.modifyValueOnWheel) {
            // 0) First, save the caret position so we can set it back once the value has been changed
            const selectionStart = e.target.selectionStart || 0;
            const selectionEnd = e.target.selectionEnd || 0;

            // 1) Get the unformatted value
            const currentUnformattedValue = this.settings.rawValue;
            let result;
            if (AutoNumericHelper.isUndefinedOrNullOrEmpty(currentUnformattedValue)) {
                // If by default the input is empty, start at '0'
                if (this.settings.minimumValue > 0 || this.settings.maximumValue < 0) {
                    // or if '0' is not between min and max value, 'minimumValue' if the user does a wheelup, 'maximumValue' if the user does a wheeldown
                    if (AutoNumericHelper.isWheelUpEvent(e)) {
                        result = this.settings.minimumValue;
                    } else if (AutoNumericHelper.isWheelDownEvent(e)) {
                        result = this.settings.maximumValue;
                    } else {
                        AutoNumericHelper.throwError(`The event is not a 'wheel' event.`);
                    }
                } else {
                    result = 0;
                }
            } else {
                result = currentUnformattedValue;
            }

            result = +result; // Typecast to a number needed for the following addition/subtraction

            // 2) Increment/Decrement the value
            // But first, choose the increment/decrement method ; fixed or progressive
            if (AutoNumericHelper.isNumber(this.settings.wheelStep)) {
                const step = +this.settings.wheelStep; // Typecast to a number needed for the following addition/subtraction
                // Fixed method
                // This is the simplest method, where a fixed offset in added/subtracted from the current value
                if (AutoNumericHelper.isWheelUpEvent(e)) { // Increment
                    result = result + step;
                } else if (AutoNumericHelper.isWheelDownEvent(e)) { // Decrement
                    result = result - step;
                }
            } else {
                // Progressive method
                // For this method, we calculate an offset that is in relation to the size of the current number (using only the integer part size).
                // The bigger the number, the bigger the offset (usually the number count in the integer part minus 3, except for small numbers where a different behavior is better for the user experience).
                if (AutoNumericHelper.isWheelUpEvent(e)) { // Increment
                    result = AutoNumericHelper.addAndRoundToNearestAuto(result);
                } else if (AutoNumericHelper.isWheelDownEvent(e)) { // Decrement
                    result = AutoNumericHelper.subtractAndRoundToNearestAuto(result);
                }
            }

            // 3) Set the new value so it gets formatted
            // First clamp the result if needed
            result = AutoNumericHelper.clampToRangeLimits(result, this.settings);
            if (result !== +currentUnformattedValue) {
                // Only 'set' the value if it has changed. For instance 'set' should not happen if the user hits a limit and continue to try to go past it since we clamp the value.
                this.set(result);
            }

            //XXX Do not prevent if the value is not modified? From a UX point of view, preventing the wheel event when the user use it on top of an autoNumeric element should always be done, even if the value does not change. Perhaps that could affect other scripts relying on this event to be sent though.
            e.preventDefault(); // We prevent the page to scroll while we increment/decrement the value

            // 4) Finally, we set back the caret position/selection
            // There is no need to take into account the fact that the number count could be different at the end of the wheel event ; it would be too complex and most of the time unreliable
            this._setSelection(selectionStart, selectionEnd);
        }
    }

    /**
     * Handler for 'submit' events happening on the parent <form> element
     */
    _onFormSubmit() {
        if (this.settings.unformatOnSubmit) {
            AutoNumericHelper.setElementValue(this.domElement, this.settings.rawValue);
        }
    }

    /**
     * Listen for the `alt` key keydown event globally, and if the event is caught, unformat the AutoNumeric element that is hovered by the mouse.
     *
     * @param {KeyboardEvent} e
     * @private
     */
    _onKeydownGlobal(e) {
        //TODO Find a way to keep the caret position between the alt keyup/keydown states
        if (AutoNumericHelper.character(e) === AutoNumericEnum.keyName.Alt) {
            const hoveredElement = AutoNumericHelper.getHoveredElement();
            if (AutoNumeric.isManagedByAutoNumeric(hoveredElement)) {
                const anElement = AutoNumeric.getAutoNumericElement(hoveredElement);
                this.constructor._unformatAltHovered(anElement);
            }
        }
    }

    /**
     * Listen for the `alt` key keyup event globally, and if the event is caught, reformat the AutoNumeric element that is hovered by the mouse.
     *
     * @param {KeyboardEvent} e
     * @private
     */
    _onKeyupGlobal(e) {
        if (AutoNumericHelper.character(e) === AutoNumericEnum.keyName.Alt) {
            const hoveredElement = AutoNumericHelper.getHoveredElement();
            if (AutoNumeric.isManagedByAutoNumeric(hoveredElement)) {
                const anElement = AutoNumeric.getAutoNumericElement(hoveredElement);
                this.constructor._reformatAltHovered(anElement);
            }
        }
    }

    /**
     * Return `true` if the DOM element is supported by autoNumeric.
     * A supported element is an element whitelisted in the `allowedTagList`.
     *
     * @returns {boolean}
     * @private
     */
    _isElementTagSupported() { //FIXME à tester
        if (!AutoNumericHelper.isElement(this.domElement)) {
            AutoNumericHelper.throwError(`The DOM element is not valid, ${this.domElement} given.`);
        }

        return AutoNumericHelper.isInArray(this.domElement.tagName.toLowerCase(), this.settings.tagList);
    }

    /**
     * Return `true` in the DOM element is an <input>.
     *
     * @returns {boolean}
     * @private
     */
    _isInputElement() { //FIXME à tester
        return this.domElement.tagName.toLowerCase() === 'input';
    }

    /**
     * Return `true` if the input type is supported by AutoNumeric
     *
     * @returns {boolean}
     * @throws
     */
    _isInputTypeSupported() { //FIXME à tester
        return (this.domElement.type === 'text' ||
                this.domElement.type === 'hidden' ||
                this.domElement.type === 'tel' ||
                AutoNumericHelper.isUndefinedOrNullOrEmpty(this.domElement.type));
    }

    /**
     * Check if the DOM element is supported by autoNumeric.
     * A supported element is either an <input> element with the right 'type' attribute, or a tag whitelisted in the `allowedTagList`.
     * If the check fails, this method throws.
     * This function also set the info `this.isInputElement` which keep tracks if the DOM element is an <input> or not, and the `this.isContentEditable` if the element has the `contenteditable` attribute set to `true`.
     *
     * @throws
     * @private
     */
    _checkElement() {
        const currentElementTag = this.domElement.tagName.toLowerCase();

        if (!this._isElementTagSupported()) {
            AutoNumericHelper.throwError(`The <${currentElementTag}> tag is not supported by autoNumeric`);
        }

        if (this._isInputElement()) {
            if (!this._isInputTypeSupported()) {
                AutoNumericHelper.throwError(`The input type "${this.domElement.type}" is not supported by autoNumeric`);
            }
            this.isInputElement = true;
        } else {
            this.isInputElement = false;

            if (this.domElement.hasAttribute('contenteditable') && this.domElement.getAttribute('contenteditable') === 'true') {
                this.isContentEditable = true;
            } else {
                this.isContentEditable = false;
            }
        }
    }

    /**
     * Formats the default value on page load.
     * This is called only if the `formatOnPageLoad` option is set to `true`.
     *
     * @param {number|string|null} forcedInitialValue The value that should be used for initialization, in place on the eventual html one
     */
    _formatDefaultValueOnPageLoad(forcedInitialValue = null) {
        let setValue = true;
        let currentValue;
        if (!AutoNumericHelper.isNull(forcedInitialValue)) {
            currentValue = forcedInitialValue;
        } else {
            currentValue = AutoNumericHelper.getElementValue(this.domElement);
        }

        if (this.isInputElement || this.isContentEditable) {
            /*
             * If the input value has been set by the dev, but not directly as an attribute in the html, then it takes
             * precedence and should get formatted during the initialization (if this input value is a valid number and that the
             * developer wants it formatted on init (cf. the `settings.formatOnPageLoad` option)).
             * Note; this is true whatever the developer has set for `data-default-value-override` in the html (asp.net users).
             *
             * In other words : if `defaultValueOverride` is not null, it means the developer is trying to prevent postback problems.
             * But if `input.value` is set to a number, and the html `value` attribute is not set, then it means the dev has
             * changed the input value, and then it means we should not overwrite his own decision to do so.
             * Hence, if `defaultValueOverride` is not null, but `input.value` is a number and `this.domElement.hasAttribute('value')`
             * is false, we should ignore `defaultValueOverride` altogether.
             */
            const unLocalizedCurrentValue = this.constructor._toNumericValue(currentValue, this.settings); // This allows to use a localized value on startup
            if (!this.domElement.hasAttribute('value') || this.domElement.getAttribute('value') === '') {
                // Check if the `value` is valid or not
                if (!isNaN(Number(unLocalizedCurrentValue)) && Infinity !== unLocalizedCurrentValue) {
                    this.set(unLocalizedCurrentValue);
                    setValue = false;
                } else {
                    // If not, inform the developer that nothing usable has been provided
                    AutoNumericHelper.throwError(`The value [${currentValue}] used in the input is not a valid value autoNumeric can work with.`);
                }
            } else {
                /* Checks for :
                 * - page reload from back button, and
                 * - ASP.net form post back
                 *      The following HTML data attribute is REQUIRED (data-an-default="same value as the value attribute")
                 *      example: <asp:TextBox runat="server" id="someID" text="1234.56" data-an-default="1234.56">
                 */
                if ((this.settings.defaultValueOverride !== null && this.settings.defaultValueOverride.toString() !== currentValue) ||
                    (this.settings.defaultValueOverride === null && currentValue !== '' && currentValue !== this.domElement.getAttribute('value')) ||
                    (currentValue !== '' && this.domElement.getAttribute('type') === 'hidden' && !AutoNumericHelper.isNumber(unLocalizedCurrentValue))) {
                    if ((this.settings.decimalPlacesShownOnFocus !== null && this.settings.saveValueToSessionStorage) ||
                        (this.settings.scaleDivisor && this.settings.saveValueToSessionStorage)) {
                        this.settings.rawValue = this._saveValueToPersistentStorage('get');
                    }

                    // If the decimalPlacesShownOnFocus value should NOT be saved in sessionStorage
                    if (!this.settings.saveValueToSessionStorage) {
                        let toStrip;

                        if (this.settings.negativeBracketsTypeOnBlur !== null && this.settings.negativeSignCharacter !== '') {
                            this.settings.hasFocus = true; //TODO Why do we set the focus information here? That's not logical and should be removed. //FIXME delete this
                            toStrip = this.constructor._toggleNegativeBracket(currentValue, this.settings);
                        } else {
                            toStrip = currentValue;
                        }

                        if ((this.settings.negativePositiveSignPlacement === 's' ||
                            (this.settings.negativePositiveSignPlacement !== 'p' && this.settings.currencySymbolPlacement === 's')) &&
                            this.settings.negativeSignCharacter !== '' &&
                            AutoNumericHelper.isNegative(currentValue)) {
                            this.settings.rawValue = this.settings.negativeSignCharacter + this.constructor._stripAllNonNumberCharacters(toStrip, this.settings, true);
                        } else {
                            this.settings.rawValue = this.constructor._stripAllNonNumberCharacters(toStrip, this.settings, true);
                        }
                    }

                    setValue = false;
                }
            }

            if (currentValue === '') {
                switch (this.settings.emptyInputBehavior) {
                    case 'focus':
                        setValue = false;
                        break;
                    case 'always':
                        AutoNumericHelper.setElementValue(this.domElement, this.settings.currencySymbol);
                        setValue = false;
                        break;
                    case 'zero':
                        this.set('0');
                        setValue = false;
                        break;
                    default :
                    //
                }
            } else if (setValue && currentValue === this.domElement.getAttribute('value')) {
                this.set(currentValue);
            }
        } else {
            if (this.settings.defaultValueOverride === null) {
                this.set(currentValue);
            } else {
                if (this.settings.defaultValueOverride === currentValue) {
                    this.set(currentValue);
                }
            }
        }
    }

    /**
     * Enhance the user experience by modifying the default `negativePositiveSignPlacement` option depending on `currencySymbol` and `currencySymbolPlacement`.
     *
     * If the user has not set the placement of the negative sign (`negativePositiveSignPlacement`), but has set a currency symbol (`currencySymbol`),
     * then we modify the default value of `negativePositiveSignPlacement` in order to keep the resulting output logical by default :
     * - "$-1,234.56" instead of "-$1,234.56" ({currencySymbol: "$", negativePositiveSignPlacement: "r"})
     * - "-1,234.56$" instead of "1,234.56-$" ({currencySymbol: "$", currencySymbolPlacement: "s", negativePositiveSignPlacement: "p"})
     */
    _correctNegativePositiveSignPlacementOption() {
        // If negativePositiveSignPlacement is already set, we do not overwrite it
        if (!AutoNumericHelper.isNull(this.settings.negativePositiveSignPlacement)) {
            return;
        }

        if (!AutoNumericHelper.isUndefined(this.settings) &&
            AutoNumericHelper.isUndefinedOrNullOrEmpty(this.settings.negativePositiveSignPlacement) &&
            !AutoNumericHelper.isUndefinedOrNullOrEmpty(this.settings.currencySymbol)) {
            switch (this.settings.currencySymbolPlacement) {
                case 's':
                    this.settings.negativePositiveSignPlacement = 'p'; // Default -1,234.56 €
                    break;
                case 'p':
                    this.settings.negativePositiveSignPlacement = 'l'; // Default -$1,234.56
                    break;
                default :
                //
            }
        } else {
            // Sets the default value if `negativePositiveSignPlacement` is `null`
            this.settings.negativePositiveSignPlacement = 'l';
        }
    }

    /**
     * Analyze and save the minimumValue and maximumValue integer size for later uses
     */
    _calculateVMinAndVMaxIntegerSizes() {
        let [maximumValueIntegerPart] = this.settings.maximumValue.toString().split('.');
        let [minimumValueIntegerPart] = (!this.settings.minimumValue && this.settings.minimumValue !== 0)?[]:this.settings.minimumValue.toString().split('.');
        maximumValueIntegerPart = maximumValueIntegerPart.replace('-', '');
        minimumValueIntegerPart = minimumValueIntegerPart.replace('-', '');

        this.settings.mIntPos = Math.max(maximumValueIntegerPart.length, 1);
        this.settings.mIntNeg = Math.max(minimumValueIntegerPart.length, 1);
    }

    /**
     * Modify `decimalPlacesOverride` as needed
     */
    _correctDecimalPlacesOverrideOption() {
        if (AutoNumericHelper.isNull(this.settings.decimalPlacesOverride)) {
            this.settings.decimalPlacesOverride = this.constructor._maximumVMinAndVMaxDecimalLength(this.settings.minimumValue, this.settings.maximumValue);
        }
        this.settings.originalDecimalPlacesOverride = String(this.settings.decimalPlacesOverride);

        // Most calculus assume `decimalPlacesOverride` is an integer, the following statement makes it clear (otherwise having it as a string leads to problems in rounding for instance)
        this.settings.decimalPlacesOverride = Number(this.settings.decimalPlacesOverride);
    }

    /**
     * Sets the alternative decimal separator key.
     */
    _setsAlternativeDecimalSeparatorCharacter() {
        if (AutoNumericHelper.isNull(this.settings.decimalCharacterAlternative) && Number(this.settings.decimalPlacesOverride) > 0) {
            if (this.settings.decimalCharacter === '.' && this.settings.digitGroupSeparator !== ',') {
                this.settings.decimalCharacterAlternative = ',';
            } else if (this.settings.decimalCharacter === ',' && this.settings.digitGroupSeparator !== '.') {
                this.settings.decimalCharacterAlternative = '.';
            }
        }
    }

    /**
     * Caches regular expressions for _stripAllNonNumberCharacters
     */
    _cachesUsualRegularExpressions() {
        const allNumbersReg = '[0-9]';
        const noAllNumbersReg = '[^0-9]';

        // Test if there is a negative character in the string
        const aNegReg = this.settings.negativeSignCharacter?`([-\\${this.settings.negativeSignCharacter}]?)`:'(-?)';
        this.settings.aNegRegAutoStrip = aNegReg;

        let negativeSignRegPart;
        if (this.settings.negativeSignCharacter) {
            negativeSignRegPart = `\\${this.settings.negativeSignCharacter}`;
        } else {
            negativeSignRegPart = '';
        }

        this.settings.skipFirstAutoStrip = new RegExp(`${aNegReg}[^-${negativeSignRegPart}\\${this.settings.decimalCharacter}${allNumbersReg}].*?(${allNumbersReg}|\\${this.settings.decimalCharacter}${allNumbersReg})`);
        this.settings.skipLastAutoStrip = new RegExp(`(${allNumbersReg}\\${this.settings.decimalCharacter}?)[^\\${this.settings.decimalCharacter}${allNumbersReg}]${noAllNumbersReg}*$`);

        const allowed = `-0123456789\\${this.settings.decimalCharacter}`;
        this.settings.allowedAutoStrip = new RegExp(`[^${allowed}]`, 'g');
        this.settings.numRegAutoStrip = new RegExp(`${aNegReg}(?:\\${this.settings.decimalCharacter}?(${allNumbersReg}+\\${this.settings.decimalCharacter}${allNumbersReg}+)|(${allNumbersReg}*(?:\\${this.settings.decimalCharacter}${allNumbersReg}*)?))`);

        // Using this regex version `^${this.settings.aNegRegAutoStrip}0*(\\d|$)` entirely clear the input on blur
        this.settings.stripReg = new RegExp(`^${this.settings.aNegRegAutoStrip}0*(${allNumbersReg})`);
    }

    /**
     * Modify the user settings to make them 'exploitable' later.
     */
    _transformOptionsValuesToDefaultTypes() {
        for (const key in this.settings) {
            if (this.settings.hasOwnProperty(key)) {
                const value = this.settings[key];

                // Convert the strings 'true' and 'false' to booleans
                if (value === 'true' || value === 'false') {
                    this.settings[key] = value === 'true';
                }

                // Convert numbers in options to strings
                //TODO if a value is already of type 'Number', shouldn't we keep it as a number for further manipulation, instead of using a string?
                if (typeof value === 'number' && key !== 'aScale') { //FIXME Replace the old `aScale` name with the new one
                    this.settings[key] = value.toString();
                }
            }
        }
    }

    /**
     * Convert the old settings options name to new ones.
     *
     * @param {object} options
     */
    static _convertOldOptionsToNewOnes(options) {
        //TODO Delete this function once the old options are not used anymore
        const oldOptionsConverter = {
            // Old option name, with their corresponding new option
            aSep                              : 'digitGroupSeparator',
            nSep                              : 'noSeparatorOnFocus',
            dGroup                            : 'digitalGroupSpacing',
            aDec                              : 'decimalCharacter',
            altDec                            : 'decimalCharacterAlternative',
            aSign                             : 'currencySymbol',
            pSign                             : 'currencySymbolPlacement',
            pNeg                              : 'negativePositiveSignPlacement',
            aSuffix                           : 'suffixText',
            oLimits                           : 'overrideMinMaxLimits',
            vMax                              : 'maximumValue',
            vMin                              : 'minimumValue',
            mDec                              : 'decimalPlacesOverride',
            eDec                              : 'decimalPlacesShownOnFocus',
            scaleDecimal                      : 'scaleDecimalPlaces',
            aStor                             : 'saveValueToSessionStorage',
            mRound                            : 'roundingMethod',
            aPad                              : 'allowDecimalPadding',
            nBracket                          : 'negativeBracketsTypeOnBlur',
            wEmpty                            : 'emptyInputBehavior',
            lZero                             : 'leadingZero',
            aForm                             : 'formatOnPageLoad',
            sNumber                           : 'selectNumberOnly',
            anDefault                         : 'defaultValueOverride',
            unSetOnSubmit                     : 'unformatOnSubmit',
            outputType                        : 'outputFormat',
            debug                             : 'showWarnings',
            // Current options :
            digitGroupSeparator               : true,
            noSeparatorOnFocus                : true,
            digitalGroupSpacing               : true,
            decimalCharacter                  : true,
            decimalCharacterAlternative       : true,
            currencySymbol                    : true,
            currencySymbolPlacement           : true,
            negativePositiveSignPlacement     : true,
            showPositiveSign                  : true,
            suffixText                        : true,
            overrideMinMaxLimits              : true,
            maximumValue                      : true,
            minimumValue                      : true,
            decimalPlacesOverride             : true,
            decimalPlacesShownOnFocus         : true,
            scaleDivisor                      : true,
            scaleDecimalPlaces                : true,
            scaleSymbol                       : true,
            saveValueToSessionStorage         : true,
            onInvalidPaste                    : true,
            roundingMethod                    : true,
            allowDecimalPadding               : true,
            negativeBracketsTypeOnBlur        : true,
            emptyInputBehavior                : true,
            leadingZero                       : true,
            formatOnPageLoad                  : true,
            selectNumberOnly                  : true,
            defaultValueOverride              : true,
            unformatOnSubmit                  : true,
            outputFormat                      : true,
            isCancellable                     : true,
            modifyValueOnWheel                : true,
            wheelStep                         : true,
            serializeSpaces                   : true,
            showWarnings                      : true,
            noEventListeners                  : true,
            readOnly                          : true,
            unformatOnHover                   : true,
            failOnUnknownOption               : true,
            //FIXME Find a way to exclude those internal data from the settings object (ideally by using another object, or better yet, class attributes) -->
            hasFocus                          : true,
            rawValue                          : true,
            trailingNegative                  : true,
            caretFix                          : true,
            throwInput                        : true,
            strip                             : true,
            tagList                           : true,
            negativeSignCharacter             : true,
            positiveSignCharacter             : true,
            mIntPos                           : true,
            mIntNeg                           : true,
            originalDecimalPlacesOverride     : true,
            originalAllowDecimalPadding       : true,
            originalNegativeBracketsTypeOnBlur: true,
            originalDigitGroupSeparator       : true,
            originalCurrencySymbol            : true,
            originalSuffixText                : true,
            aNegRegAutoStrip                  : true,
            skipFirstAutoStrip                : true,
            skipLastAutoStrip                 : true,
            allowedAutoStrip                  : true,
            numRegAutoStrip                   : true,
            stripReg                          : true,
        };

        for (const option in options) {
            if (options.hasOwnProperty(option)) {
                if (oldOptionsConverter[option] === true) {
                    // If the option is a 'new' option, we continue looping
                    continue;
                }

                if (oldOptionsConverter.hasOwnProperty(option)) {
                    // Else we have an 'old' option name
                    AutoNumericHelper.warning(`You are using the deprecated option name '${option}'. Please use '${oldOptionsConverter[option]}' instead from now on. The old option name will be dropped soon.`, true);

                    // Then we modify the initial option object to use the new options instead of the old ones
                    options[oldOptionsConverter[option]] = options[option];
                    delete options[option];
                } else if (options.failOnUnknownOption) {
                    // ...or the option name is unknown. This means there is a problem with the options object, therefore we throw an error.
                    AutoNumericHelper.throwError(`Option name '${option}' is unknown. Please fix the options passed to autoNumeric`);
                }
            }
        }
    }

    /**
     * Analyse the settings/options passed by the user, validate and clean them, then set them into `this.settings`.
     * Note: This sets the settings to `null` if somehow the settings objet is undefined or empty
     *
     * @param {object} options
     * @param {boolean} update - If set to `true`, then the settings already exists and this function only updates them instead of recreating them from scratch
     * @throws
     */
    _setSettings(options, update = false) {
        // If the user used old options, we convert them to new ones
        if (update || !AutoNumericHelper.isNull(options)) {
            this.constructor._convertOldOptionsToNewOnes(options);
        }

        if (update) {
            // The settings are updated
            this._mergeSettings(options);
        } else {
            // The settings are generated for the first time
            this.settings = {};
            // If we couldn't grab any settings, create them from the default ones and combine them with the options passed as a parameter as well as with the HTML5 `data-*` info (via `this.domElement.dataset`), if any.
            this._mergeSettings(this.constructor.getDefaultConfig(), this.domElement.dataset, options, {
                hasFocus        : false,
                rawValue        : '',
                trailingNegative: false,
                caretFix        : false,
                throwInput      : true, // Throw input event
                strip           : true,
                tagList         : AutoNumericEnum.allowedTagList,
            });
            this.runOnce = false;
            this.hoveredWithAlt = false; // Keep tracks if the current aN element is hovered by the mouse cursor while `Alt` is pressed
        }

        // Modify the user settings to make them 'exploitable'
        this._transformOptionsValuesToDefaultTypes();

        // Improve the `negativePositiveSignPlacement` option if needed
        this._correctNegativePositiveSignPlacementOption();

        // Set the negative and positive signs, as needed
        this.settings.negativeSignCharacter = this.settings.minimumValue < 0 ? '-' : '';
        this.settings.positiveSignCharacter = this.settings.maximumValue >= 0 ? '+' : '';

        // Additional changes to the settings object (from the original autoCode() function)
        this._runCallbacksFoundInTheSettingsObject();
        this._calculateVMinAndVMaxIntegerSizes();
        this._correctDecimalPlacesOverrideOption();
        this._setsAlternativeDecimalSeparatorCharacter();
        this._cachesUsualRegularExpressions();

        // Validate the settings. Both tests throws if necessary.
        this.constructor.validate(this.settings, false);
        if (AutoNumericHelper.isEmptyObj(this.settings)) {
            AutoNumericHelper.throwError('Unable to set the settings, those are invalid ; an empty object was given.');
        }

        // Original settings saved for use when decimalPlacesShownOnFocus, scaleDivisor & noSeparatorOnFocus options are being used
        this._keepAnOriginalSettingsCopy();
    }

    /**
     * Convert the `value` parameter that can either be :
     * - a real number,
     * - a string representing a real number, or
     * - a string representing a localized number (with specific group separators and decimal character),
     * ...to a string representing a real 'javascript' number (ie. '1234' or '1234.567').
     *
     * This function returns `NaN` if such conversion fails.
     *
     * @param {int|float|string} value
     * @param {object} settings
     * @returns {string|NaN}
     */
    static _toNumericValue(value, settings) {
        //XXX Note; this function is static since we need to pass a `settings` object when calling the static `AutoNumeric.format()` method
        let result;
        if (AutoNumericHelper.isNumber(Number(value))) {
            // The value has either already been stripped, or a 'real' javascript number is passed as a parameter
            result = value;
        } else {
            // Else if it's a string that `Number()` cannot typecast, then we try to convert the localized numeric string to a numeric one
            // Convert the value to a numeric string, stripping unnecessary characters in the process
            result = this._convertToNumericString(value.toString(), settings);

            // If the result is still not a numeric string, then we throw a warning
            if (!AutoNumericHelper.isNumber(Number(result))) {
                AutoNumericHelper.warning(`The value "${value}" being "set" is not numeric and therefore cannot be used appropriately.`, settings.showWarnings);
                result = NaN;
            }
        }

        return result;
    }

    /**
     * Return the pasted text that will be used.
     *
     * @param {string} text
     * @returns {string|void|XML|*}
     */
    _preparePastedText(text) {
        return this.constructor._stripAllNonNumberCharacters(text, this.settings, true).replace(this.settings.decimalCharacter, '.');
    }

    /**
     * Return TRUE if the given value (a number as a string) is within the range set in the settings `minimumValue` and `maximumValue`, FALSE otherwise.
     *
     * @param {string} value
     * @param {object} parsedMinValue Parsed via the `parseStr()` function
     * @param {object} parsedMaxValue Parsed via the `parseStr()` function
     * @returns {boolean}
     */
    static _checkIfInRange(value, parsedMinValue, parsedMaxValue) {
        const parsedValue = AutoNumericHelper.parseStr(value);
        return AutoNumericHelper.testMinMax(parsedMinValue, parsedValue) > -1 && AutoNumericHelper.testMinMax(parsedMaxValue, parsedValue) < 1;
    }

    /**
     * Update the selection values as well as resets the internal state of the current AutoNumeric object.
     * This keeps tracks of the current selection and resets the 'processed' and 'formatted' state.
     *
     * Note : Those two can change between the keydown, keypress and keyup events, that's why
     *        this function is called on each event handler.
     *
     * @private
     */
    _updateInternalProperties() {
        this.selection = AutoNumericHelper.getElementSelection(this.domElement);
        this.processed = false;
        this.formatted = false;
    }

    /**
     * Update the keycode of the key that triggered the given event.
     * Note : e.which is sometimes different than e.keyCode during the keypress event, when entering a printable character key (ie. 't'). `e.which` equals 0 for non-printable characters.
     *
     * //TODO Switch to the non-deprecated e.key attribute, instead of inconsistant e.which and e.keyCode.
     * e.key describe the key name used to trigger the event.
     * e.keyCode being deprecated : https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
     * How e.key works : https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     * The key list is described here
     * @link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
     *
     * @param {Event} e
     * @private
     */
    _updateEventKeycode(e) {
        // Note: the keypress event overwrites meaningful value of e.keyCode, hence we do not update that value on 'keypress'
        this.eventKeyCode = AutoNumericHelper.keyCodeNumber(e);
    }

    /**
     * Save the unformatted element value.
     * This is used in the 'cancellable' feature where the element value is saved on focus and input validation, to be used if the user wants to cancel his modifications by hitting the 'Escape' key.
     *
     * @private
     */
    _saveCancellableValue() {
        this.savedCancellableValue = this.settings.rawValue;
    }

    /**
     * Set the text selection inside the input with the given start and end position.
     *
     * @param {int} start
     * @param {int} end
     * @private
     */
    _setSelection(start, end) {
        start = Math.max(start, 0);
        end = Math.min(end, AutoNumericHelper.getElementValue(this.domElement).length);
        this.selection = {
            start,
            end,
            length: end - start,
        };

        AutoNumericHelper.setElementSelection(this.domElement, start, end);
    }

    /**
     * Set the caret position inside the input at the given position.
     *
     * @param {int} position
     * @private
     */
    _setCaretPosition(position) {
        this._setSelection(position, position);
    }

    /**
     * Return an array containing the string parts located on the left and right side of the caret or selection.
     * Those parts are left 'untouched', ie. formatted by autoNumeric.
     *
     * @returns {[string, string]} The parts on the left and right of the caret or selection
     * @private
     */
    _getLeftAndRightPartAroundTheSelection() {
        const value = AutoNumericHelper.getElementValue(this.domElement);
        const left = value.substring(0, this.selection.start);
        const right = value.substring(this.selection.end, value.length);

        return [left, right];
    }

    /**
     * Return an array containing the string parts located on the left and right side of the caret or selection.
     * Those parts are unformatted (stripped) of any non-numbers characters.
     *
     * @returns {[string, string]} The parts on the left and right of the caret or selection, unformatted.
     * @private
     */
    _getUnformattedLeftAndRightPartAroundTheSelection() {
        let [left, right] = this._getLeftAndRightPartAroundTheSelection();
        if (left === '' && right === '') {
            this.settings.trailingNegative = false;
        }

        // If changing the sign and `left` is equal to the number zero - prevents stripping the leading zeros
        let stripZeros = true;
        if (this.eventKeyCode === AutoNumericEnum.keyCode.Hyphen && Number(left) === 0) {
            stripZeros = false;
        }

        left = AutoNumeric._stripAllNonNumberCharacters(left, this.settings, stripZeros);
        right = AutoNumeric._stripAllNonNumberCharacters(right, this.settings, false);

        if (this.settings.trailingNegative && !AutoNumericHelper.isNegative(left)) {
            left = '-' + left;
            right = (right === '-') ? '' : right;
            this.settings.trailingNegative = false;
        }

        return [left, right];
    }

    /**
     * Strip parts from excess characters and leading zeros.
     *
     * @param {string} left
     * @param {string} right
     * @returns {[*,*]}
     * @private
     */
    _normalizeParts(left, right) {
        // if changing the sign and left is equal to the number zero - prevents stripping the leading zeros
        let stripZeros = true;
        if (this.eventKeyCode === AutoNumericEnum.keyCode.Hyphen && Number(left) === 0) {
            stripZeros = false;
        }
        left = AutoNumeric._stripAllNonNumberCharacters(left, this.settings, stripZeros);

        // If right is not empty and first character is not decimalCharacter
        right = AutoNumeric._stripAllNonNumberCharacters(right, this.settings, false);

        // Prevents multiple leading zeros from being entered
        if (this.settings.leadingZero === 'deny' &&
            (this.eventKeyCode === AutoNumericEnum.keyCode.num0 || this.eventKeyCode === AutoNumericEnum.keyCode.numpad0) &&
            Number(left) === 0 &&
            !AutoNumericHelper.contains(left, this.settings.decimalCharacter)  && right !== '') {
            left = left.substring(0, left.length - 1);
        }

        if (this.settings.trailingNegative && !AutoNumericHelper.isNegative(left)) {
            left = '-' + left;
            this.settings.trailingNegative = false;
        }

        // Insert zero if has leading dot
        this.newValue = left + right;
        if (this.settings.decimalCharacter) {
            const m = this.newValue.match(new RegExp(`^${this.settings.aNegRegAutoStrip}\\${this.settings.decimalCharacter}`));
            if (m) {
                left = left.replace(m[1], m[1] + '0');
                this.newValue = left + right;
            }
        }

        return [left, right];
    }

    /**
     * Set part of number to value while keeping the cursor position. //TODO What about the cursor selection?
     *
     * @param {string} left
     * @param {string} right
     * @param {boolean} isPaste
     * @returns {boolean}
     * @private
     */
    _setValueParts(left, right, isPaste = false) {
        const parts = this._normalizeParts(left, right);
        const [minTest, maxTest] = AutoNumeric._checkIfInRangeWithOverrideOption(this.newValue, this.settings);
        let position = parts[0].length;
        this.newValue = parts.join('');

        if (minTest && maxTest) {
            this.newValue = AutoNumeric._truncateDecimal(this.newValue, this.settings, isPaste);
            //TODO Check if we need to replace the hard-coded ',' with settings.decimalCharacter
            const testValue = (AutoNumericHelper.contains(this.newValue, ',')) ? this.newValue.replace(',', '.') : this.newValue;
            if (testValue === '' || testValue === this.settings.negativeSignCharacter) {
                this.settings.rawValue = (this.settings.emptyInputBehavior === 'zero') ? '0' : '';
            } else {
                this.settings.rawValue = this._cleanLeadingTrailingZeros(testValue);
            }

            if (position > this.newValue.length) {
                position = this.newValue.length;
            }

            // Make sure when the user enter a '0' on the far left with a leading zero option set to 'deny', that the caret does not moves since the input is dropped (fix issue #283)
            if (position === 1 && parts[0] === '0' && this.settings.leadingZero === 'deny') {
                // If the user enter `0`, then the caret is put on the right side of it (Fix issue #299)
                if (parts[1] === '' || parts[0] === '0' && parts[1] !== '') {
                    position = 1;
                } else {
                    position = 0;
                }
            }

            AutoNumericHelper.setElementValue(this.domElement, this.newValue);
            this._setCaretPosition(position);

            return true;
        }

        if (!minTest) {
            AutoNumericHelper.triggerEvent('autoNumeric:minExceeded', this.domElement);
        } else if (!maxTest) {
            AutoNumericHelper.triggerEvent('autoNumeric:maxExceeded', this.domElement);
        }

        return false;
    }

    /**
     * Helper function for `_expandSelectionOnSign()`.
     *
     * @returns {Array} Array containing [signPosition, currencySymbolPosition] of a formatted value
     * @private
     */
    _getSignPosition() {
        let result;
        if (this.settings.currencySymbol) {
            const currencySymbolLen = this.settings.currencySymbol.length;
            const value = AutoNumericHelper.getElementValue(this.domElement);
            if (this.settings.currencySymbolPlacement === 'p') {
                const hasNeg = this.settings.negativeSignCharacter && value && value.charAt(0) === this.settings.negativeSignCharacter;
                if (hasNeg) {
                    result = [1, currencySymbolLen + 1];
                } else {
                    result = [0, currencySymbolLen];
                }
            } else {
                const valueLen = value.length;
                result = [valueLen - currencySymbolLen, valueLen];
            }
        } else {
            result = [1000, -1];
        }

        return result;
    }

    /**
     * Expands selection to cover whole sign
     * Prevents partial deletion/copying/overwriting of a sign
     * @private
     */
    _expandSelectionOnSign() {
        const [signPosition, currencySymbolPosition] = this._getSignPosition();
        const selection = this.selection;

        // If selection catches something except sign and catches only space from sign
        if (selection.start < currencySymbolPosition && selection.end > signPosition) {
            // Then select without empty space
            if ((selection.start < signPosition || selection.end > currencySymbolPosition) &&
                AutoNumericHelper.getElementValue(this.domElement).substring(Math.max(selection.start, signPosition), Math.min(selection.end, currencySymbolPosition))
                    .match(/^\s*$/)) {
                if (selection.start < signPosition) {
                    this._setSelection(selection.start, signPosition);
                } else {
                    this._setSelection(currencySymbolPosition, selection.end);
                }
            } else {
                // Else select with whole sign
                this._setSelection(Math.min(selection.start, signPosition), Math.max(selection.end, currencySymbolPosition));
            }
        }
    }

    /**
     * Try to strip pasted value to digits
     */
    _checkPaste() {
        if (!AutoNumericHelper.isUndefined(this.valuePartsBeforePaste)) {
            const oldParts = this.valuePartsBeforePaste;
            const [left, right] = this._getLeftAndRightPartAroundTheSelection();

            // Try to strip the pasted value first
            delete this.valuePartsBeforePaste;

            const modifiedLeftPart = left.substr(0, oldParts[0].length) + AutoNumeric._stripAllNonNumberCharacters(left.substr(oldParts[0].length), this.settings, true);
            if (!this._setValueParts(modifiedLeftPart, right, true)) {
                AutoNumericHelper.setElementValue(this.domElement, oldParts.join(''));
                this._setCaretPosition(oldParts[0].length);
            }
        }
    }

    /**
     * Process pasting, cursor moving and skipping of not interesting keys.
     * If this function returns TRUE, then further processing is not performed.
     *
     * @param {KeyboardEvent} e
     * @returns {boolean}
     * @private
     */
    _skipAlways(e) {
        // Catch the ctrl up on ctrl-v
        if (((e.ctrlKey || e.metaKey) && e.type === 'keyup' && !AutoNumericHelper.isUndefined(this.valuePartsBeforePaste)) || (e.shiftKey && this.eventKeyCode === AutoNumericEnum.keyCode.Insert)) {
            //TODO Move this test inside the `onKeyup` handler
            this._checkPaste();

            return false;
        }

        // Skip all function keys (F1-F12), Windows keys, tab and other special keys
        if ((this.eventKeyCode >= AutoNumericEnum.keyCode.F1 && this.eventKeyCode <= AutoNumericEnum.keyCode.F12) ||
            (this.eventKeyCode >= AutoNumericEnum.keyCode.Windows && this.eventKeyCode <= AutoNumericEnum.keyCode.RightClick) ||
            (this.eventKeyCode >= AutoNumericEnum.keyCode.Tab && this.eventKeyCode < AutoNumericEnum.keyCode.Space) ||
            // `e.which` is sometimes different than `this.eventKeyCode` during the keypress event when entering a printable character key (ie. 't'). Also, `e.which` equals 0 for non-printable characters.
            (this.eventKeyCode < AutoNumericEnum.keyCode.Backspace &&
            (e.which === 0 || e.which === this.eventKeyCode)) ||
            this.eventKeyCode === AutoNumericEnum.keyCode.NumLock ||
            this.eventKeyCode === AutoNumericEnum.keyCode.ScrollLock ||
            this.eventKeyCode === AutoNumericEnum.keyCode.Insert ||
            this.eventKeyCode === AutoNumericEnum.keyCode.Command) {
            return true;
        }

        // If a "Select all" keyboard shortcut is detected (ctrl + a)
        if ((e.ctrlKey || e.metaKey) && this.eventKeyCode === AutoNumericEnum.keyCode.a) {
            if (this.settings.selectNumberOnly) {
                // `preventDefault()` is used here to prevent the browser to first select all the input text (including the currency sign), otherwise we would see that whole selection first in a flash, then the selection with only the number part without the currency sign.
                e.preventDefault();
                this.selectNumber();
            }

            return true;
        }

        // If a "Copy", "Paste" or "Cut" keyboard shortcut is detected (respectively 'ctrl + c', 'ctrl + v' or 'ctrl + x')
        if ((e.ctrlKey || e.metaKey) && (this.eventKeyCode === AutoNumericEnum.keyCode.c || this.eventKeyCode === AutoNumericEnum.keyCode.v || this.eventKeyCode === AutoNumericEnum.keyCode.x)) {
            if (e.type === 'keydown') {
                this._expandSelectionOnSign();
            }

            // Try to prevent wrong paste
            if (this.eventKeyCode === AutoNumericEnum.keyCode.v || this.eventKeyCode === AutoNumericEnum.keyCode.Insert) {
                if (e.type === 'keydown' || e.type === 'keypress') {
                    if (AutoNumericHelper.isUndefined(this.valuePartsBeforePaste)) {
                        this.valuePartsBeforePaste = this._getLeftAndRightPartAroundTheSelection();
                    }
                } else {
                    this._checkPaste();
                }
            }

            return e.type === 'keydown' || e.type === 'keypress' || this.eventKeyCode === AutoNumericEnum.keyCode.c;
        }

        if (e.ctrlKey || e.metaKey) {
            return true;
        }

        // Jump over the thousand separator
        //TODO Move this test inside the `onKeydown` handler
        if (this.eventKeyCode === AutoNumericEnum.keyCode.LeftArrow || this.eventKeyCode === AutoNumericEnum.keyCode.RightArrow) {
            if (e.type === 'keydown' && !e.shiftKey) {
                const value = AutoNumericHelper.getElementValue(this.domElement);
                if (this.eventKeyCode === AutoNumericEnum.keyCode.LeftArrow &&
                    (value.charAt(this.selection.start - 2) === this.settings.digitGroupSeparator ||
                    value.charAt(this.selection.start - 2) === this.settings.decimalCharacter)) {
                    this._setCaretPosition(this.selection.start - 1);
                } else if (this.eventKeyCode === AutoNumericEnum.keyCode.RightArrow &&
                    (value.charAt(this.selection.start + 1) === this.settings.digitGroupSeparator ||
                    value.charAt(this.selection.start + 1) === this.settings.decimalCharacter)) {
                    this._setCaretPosition(this.selection.start + 1);
                }
            }

            return true;
        }

        return this.eventKeyCode >= AutoNumericEnum.keyCode.PageDown && this.eventKeyCode <= AutoNumericEnum.keyCode.DownArrow;
    }

    /**
     * Process deletion of characters when the minus sign is to the right of the numeric characters.
     *
     * @param {string} left The part on the left of the caret or selection
     * @param {string} right The part on the right of the caret or selection
     * @returns {[string, string]}
     * @private
     */
    _processCharacterDeletionIfTrailingNegativeSign([left, right]) {
        const value = AutoNumericHelper.getElementValue(this.domElement);

        if (this.settings.currencySymbolPlacement === 'p' && this.settings.negativePositiveSignPlacement === 's') {
            if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace) {
                this.settings.caretFix = (this.selection.start >= value.indexOf(this.settings.suffixText) && this.settings.suffixText !== '');
                if (value.charAt(this.selection.start - 1) === '-') {
                    left = left.substring(1);
                } else if (this.selection.start <= value.length - this.settings.suffixText.length) {
                    left = left.substring(0, left.length - 1);
                }
            } else {
                this.settings.caretFix = (this.selection.start >= value.indexOf(this.settings.suffixText) && this.settings.suffixText !== '');
                if (this.selection.start >= value.indexOf(this.settings.currencySymbol) + this.settings.currencySymbol.length) {
                    right = right.substring(1, right.length);
                }
                if (AutoNumericHelper.isNegative(left) && value.charAt(this.selection.start) === '-') {
                    left = left.substring(1);
                }
            }
        }

        //TODO Merge the two following 'if' blocks into one `if (settings.currencySymbolPlacement === 's') {` and a switch on settings.negativePositiveSignPlacement
        if (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement === 'l') {
            this.settings.caretFix = (this.selection.start >= value.indexOf(this.settings.negativeSignCharacter) + this.settings.negativeSignCharacter.length);
            if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace) {
                if (this.selection.start === (value.indexOf(this.settings.negativeSignCharacter) + this.settings.negativeSignCharacter.length) && AutoNumericHelper.contains(value, this.settings.negativeSignCharacter)) {
                    left = left.substring(1);
                } else if (left !== '-' && ((this.selection.start <= value.indexOf(this.settings.negativeSignCharacter)) || !AutoNumericHelper.contains(value, this.settings.negativeSignCharacter))) {
                    left = left.substring(0, left.length - 1);
                }
            } else {
                if (left[0] === '-') {
                    right = right.substring(1);
                }
                if (this.selection.start === value.indexOf(this.settings.negativeSignCharacter) && AutoNumericHelper.contains(value, this.settings.negativeSignCharacter)) {
                    left = left.substring(1);
                }
            }
        }

        if (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement === 'r') {
            this.settings.caretFix = (this.selection.start >= value.indexOf(this.settings.negativeSignCharacter) + this.settings.negativeSignCharacter.length);
            if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace) {
                if (this.selection.start === (value.indexOf(this.settings.negativeSignCharacter) + this.settings.negativeSignCharacter.length)) {
                    left = left.substring(1);
                } else if (left !== '-' && this.selection.start <= (value.indexOf(this.settings.negativeSignCharacter) - this.settings.currencySymbol.length)) {
                    left = left.substring(0, left.length - 1);
                } else if (left !== '' && !AutoNumericHelper.contains(value, this.settings.negativeSignCharacter)) {
                    left = left.substring(0, left.length - 1);
                }
            } else {
                this.settings.caretFix = (this.selection.start >= value.indexOf(this.settings.currencySymbol) && this.settings.currencySymbol !== '');
                if (this.selection.start === value.indexOf(this.settings.negativeSignCharacter)) {
                    left = left.substring(1);
                }
                right = right.substring(1);
            }
        }

        return [left, right];
    }

    /**
     * Process the deletion of characters.
     */
    _processCharacterDeletion() {
        let left;
        let right;

        if (!this.selection.length) {
            [left, right] = this._getUnformattedLeftAndRightPartAroundTheSelection();
            if (left === '' && right === '') {
                this.settings.throwInput = false;
            }

            if (((this.settings.currencySymbolPlacement === 'p' && this.settings.negativePositiveSignPlacement === 's') ||
                (this.settings.currencySymbolPlacement === 's' && (this.settings.negativePositiveSignPlacement === 'l' || this.settings.negativePositiveSignPlacement === 'r'))) &&
                AutoNumericHelper.isNegative(AutoNumericHelper.getElementValue(this.domElement))) {
                [left, right] = this._processCharacterDeletionIfTrailingNegativeSign([left, right]);
            } else {
                if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace) {
                    left = left.substring(0, left.length - 1);
                } else {
                    right = right.substring(1, right.length);
                }
            }
        } else {
            this._expandSelectionOnSign();
            [left, right] = this._getUnformattedLeftAndRightPartAroundTheSelection();
        }

        this._setValueParts(left, right);
    }

    /**
     * This function decides if the key pressed should be dropped or accepted, and modify the value 'on-the-fly' accordingly.
     * Returns `true` if the keycode is allowed.
     * This functions also modify the value on-the-fly. //TODO This should use another function in order to separate the test and the modification
     *
     * @param {KeyboardEvent} e
     * @returns {boolean}
     */
    _processCharacterInsertion(e) {
        let [left, right] = this._getUnformattedLeftAndRightPartAroundTheSelection();
        this.settings.throwInput = true;

        // Retrieve the real character that has been entered (ie. 'a' instead of the key code)
        const eventCharacter = AutoNumericHelper.character(e);

        // Start rules when the decimal character key is pressed always use numeric pad dot to insert decimal separator
        // Do not allow decimal character if no decimal part allowed
        if (eventCharacter === this.settings.decimalCharacter ||
            (this.settings.decimalCharacterAlternative && eventCharacter === this.settings.decimalCharacterAlternative) ||
            ((eventCharacter === '.' || eventCharacter === ',') && this.eventKeyCode === AutoNumericEnum.keyCode.DotNumpad)) {
            if (!this.settings.decimalPlacesOverride || !this.settings.decimalCharacter) {
                return true;
            }

            // Do not allow decimal character before negativeSignCharacter character
            if (this.settings.negativeSignCharacter && AutoNumericHelper.contains(right, this.settings.negativeSignCharacter)) {
                return true;
            }

            // Do not allow decimal character if other decimal character present
            if (AutoNumericHelper.contains(left, this.settings.decimalCharacter)) {
                return true;
            }

            if (right.indexOf(this.settings.decimalCharacter) > 0) {
                return true;
            }

            if (right.indexOf(this.settings.decimalCharacter) === 0) {
                right = right.substr(1);
            }

            this._setValueParts(left + this.settings.decimalCharacter, right);

            return true;
        }

        // Prevent minus if not allowed
        if ((eventCharacter === '-' || eventCharacter === '+') && this.settings.negativeSignCharacter === '-') {
            if (!this.settings) {
                return true;
            }

            // Caret is always after minus
            if ((this.settings.currencySymbolPlacement === 'p' && this.settings.negativePositiveSignPlacement === 's') || (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement !== 'p')) {
                if (left === '' && AutoNumericHelper.contains(right, this.settings.negativeSignCharacter)) {
                    left = this.settings.negativeSignCharacter;
                    right = right.substring(1, right.length);
                }

                // Change number sign, remove part if should
                if (AutoNumericHelper.isNegativeStrict(left) || AutoNumericHelper.contains(left, this.settings.negativeSignCharacter)) {
                    left = left.substring(1, left.length);
                } else {
                    left = (eventCharacter === '-') ? this.settings.negativeSignCharacter + left : left;
                }
            } else {
                if (left === '' && AutoNumericHelper.contains(right, this.settings.negativeSignCharacter)) {
                    left = this.settings.negativeSignCharacter;
                    right = right.substring(1, right.length);
                }

                // Change number sign, remove part if should
                if (left.charAt(0) === this.settings.negativeSignCharacter) {
                    left = left.substring(1, left.length);
                } else {
                    left = (eventCharacter === '-') ? this.settings.negativeSignCharacter + left : left;
                }
            }

            this._setValueParts(left, right);

            return true;
        }

        // If the user tries to insert digit before minus sign
        const eventNumber = Number(eventCharacter);
        if (eventNumber >= 0 && eventNumber <= 9) {
            if (this.settings.negativeSignCharacter && left === '' && AutoNumericHelper.contains(right, this.settings.negativeSignCharacter)) {
                left = this.settings.negativeSignCharacter;
                right = right.substring(1, right.length);
            }

            if (this.settings.maximumValue <= 0 && this.settings.minimumValue < this.settings.maximumValue && !AutoNumericHelper.contains(AutoNumericHelper.getElementValue(this.domElement), this.settings.negativeSignCharacter) && eventCharacter !== '0') {
                left = this.settings.negativeSignCharacter + left;
            }

            this._setValueParts(left + eventCharacter, right);

            return true;
        }

        // Prevent any other character
        this.settings.throwInput = false;

        return false;
    }

    /**
     * Formatting of just processed value while keeping the cursor position
     *
     * @param {Event} e
     * @private
     */
    _formatValue(e) {
        const elementValue = AutoNumericHelper.getElementValue(this.domElement);
        let [left] = this._getUnformattedLeftAndRightPartAroundTheSelection();

        // No grouping separator and no currency sign
        if ((this.settings.digitGroupSeparator  === '' || (this.settings.digitGroupSeparator !== ''  && !AutoNumericHelper.contains(elementValue, this.settings.digitGroupSeparator))) &&
            (this.settings.currencySymbol === '' || (this.settings.currencySymbol !== '' && !AutoNumericHelper.contains(elementValue, this.settings.currencySymbol)))) {
            let [subParts] = elementValue.split(this.settings.decimalCharacter);
            let nSign = '';
            if (AutoNumericHelper.isNegative(subParts)) {
                nSign = '-';
                subParts = subParts.replace('-', '');
                left = left.replace('-', '');
            }

            // Strip leading zero on positive value if needed
            if (nSign === '' && subParts.length > this.settings.mIntPos && left.charAt(0) === '0') {
                left = left.slice(1);
            }

            // Strip leading zero on negative value if needed
            if (nSign === '-' && subParts.length > this.settings.mIntNeg && left.charAt(0) === '0') {
                left = left.slice(1);
            }

            left = nSign + left;
        }

        const value = this.constructor._addGroupSeparators(elementValue, this.settings);
        let position = value.length;
        if (value) {
            // Prepare regexp which searches for cursor position from unformatted left part
            const leftAr = left.split('');

            // Fixes caret position with trailing minus sign
            if ((this.settings.negativePositiveSignPlacement === 's' || (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement !== 'p')) &&
                leftAr[0] === '-' && this.settings.negativeSignCharacter !== '') {
                leftAr.shift();

                if ((this.eventKeyCode === AutoNumericEnum.keyCode.Backspace || this.eventKeyCode === AutoNumericEnum.keyCode.Delete) &&
                    this.settings.caretFix) {
                    if (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement === 'l') {
                        leftAr.push('-');
                        this.settings.caretFix = e.type === 'keydown';
                    }

                    if (this.settings.currencySymbolPlacement === 'p' && this.settings.negativePositiveSignPlacement === 's') {
                        leftAr.push('-');
                        this.settings.caretFix = e.type === 'keydown';
                    }

                    if (this.settings.currencySymbolPlacement === 's' && this.settings.negativePositiveSignPlacement === 'r') {
                        const signParts = this.settings.currencySymbol.split('');
                        const escapeChr = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '['];
                        const escapedParts = [];
                        signParts.forEach((i, miniParts) => {
                            miniParts = signParts[i];
                            if (AutoNumericHelper.isInArray(miniParts, escapeChr)) {
                                escapedParts.push('\\' + miniParts);
                            } else {
                                escapedParts.push(miniParts);
                            }
                        });

                        if (this.eventKeyCode === AutoNumericEnum.keyCode.Backspace) {
                            escapedParts.push('-');
                        }

                        // Pushing the escaped sign
                        leftAr.push(escapedParts.join(''));
                        this.settings.caretFix = e.type === 'keydown';
                    }
                }
            }

            for (let i = 0; i < leftAr.length; i++) {
                if (!leftAr[i].match('\\d')) {
                    leftAr[i] = '\\' + leftAr[i];
                }
            }

            const leftReg = new RegExp('^.*?' + leftAr.join('.*?'));

            // Search cursor position in formatted value
            const newLeft = value.match(leftReg);
            if (newLeft) {
                position = newLeft[0].length;

                // If the positive sign is shown, calculate the caret position accordingly
                if (this.settings.showPositiveSign) {
                    if (position === 0 && newLeft.input.charAt(0) === this.settings.positiveSignCharacter) {
                        position = (newLeft.input.indexOf(this.settings.currencySymbol) === 1) ? this.settings.currencySymbol.length + 1 : 1;
                    }

                    if (position === 0 && newLeft.input.charAt(this.settings.currencySymbol.length) === this.settings.positiveSignCharacter) {
                        position = this.settings.currencySymbol.length + 1;
                    }
                }

                // If we are just before the sign which is in prefix position
                if (((position === 0 && value.charAt(0) !== this.settings.negativeSignCharacter) || (position === 1 && value.charAt(0) === this.settings.negativeSignCharacter)) && this.settings.currencySymbol && this.settings.currencySymbolPlacement === 'p') {
                    // Place caret after prefix sign
                    //TODO Should the test be 'isNegative' instead of 'isNegativeStrict' in order to search for '-' everywhere in the string?
                    position = this.settings.currencySymbol.length + (AutoNumericHelper.isNegativeStrict(value) ? 1 : 0);
                }
            } else {
                if (this.settings.currencySymbol && this.settings.currencySymbolPlacement === 's') {
                    // If we could not find a place for cursor and have a sign as a suffix
                    // Place caret before suffix currency sign
                    position -= this.settings.currencySymbol.length;
                }

                if (this.settings.suffixText) {
                    // If we could not find a place for cursor and have a suffix
                    // Place caret before suffix
                    position -= this.settings.suffixText.length;
                }
            }
        }

        // Only update the value if it has changed. This prevents modifying the selection, if any.
        if (value !== elementValue ||
            value === elementValue && (this.eventKeyCode === AutoNumericEnum.keyCode.num0 || this.eventKeyCode === AutoNumericEnum.keyCode.numpad0)) {
            AutoNumericHelper.setElementValue(this.domElement, value);
            this._setCaretPosition(position);
        }

        this.formatted = true; //TODO Rename `this.formatted` to `this._formatExecuted`, since it's possible this function does not need to format anything (in the case where the keycode is dropped for instance)
    }

    /**
     * Serialize the form child <input> element values to a string, or an Array.
     * The output format is defined with the `formatType` argument.
     * This is loosely based upon http://stackoverflow.com/a/40705993/2834898.
     *
     * @param {HTMLFormElement} form
     * @param {boolean} intoAnArray If `true`, instead of generating a string, it generates an Array.
     * @param {string} formatType If `'unformatted'`, then the AutoNumeric elements values are unformatted, if `'localized'`, then the AutoNumeric elements values are localized, and if `'formatted'`, then the AutoNumeric elements values are kept formatted. In either way, this function does not modify the value of each DOM element, but only affect the value that is returned by that serialize function.
     * @param {string} serializedSpaceCharacter Can either be the '+' character, or the '%20' string.
     * @param {string|null} forcedOutputFormat If set, then this is the format that is used for the localization, instead of the default `outputFormat` option.
     * @returns {string|Array}
     * @private
     */
    static _serialize(form, intoAnArray = false, formatType = 'unformatted', serializedSpaceCharacter = '+', forcedOutputFormat = null) {
        const result = [];

        if (typeof form === 'object' && form.nodeName.toLowerCase() === 'form') {
            Array.prototype.slice.call(form.elements).forEach(element => {
                if (element.name &&
                    !element.disabled &&
                    ['file', 'reset', 'submit', 'button'].indexOf(element.type) === -1) {
                    if (element.type === 'select-multiple') {
                        Array.prototype.slice.call(element.options).forEach(option => {
                            if (option.selected) {
                                //TODO Should we unformat/format/localize the selection option (which be default should be read-only)?
                                if (intoAnArray) {
                                    result.push({ name: element.name, value: option.value });
                                } else { // into a string
                                    result.push(`${encodeURIComponent(element.name)}=${encodeURIComponent(option.value)}`);
                                }
                            }
                        });
                    } else if (['checkbox', 'radio'].indexOf(element.type) === -1 || element.checked) {
                        let valueResult;
                        if (this.isManagedByAutoNumeric(element)) {
                            let anObject;
                            switch (formatType) {
                                case 'unformatted':
                                    anObject = this.getAutoNumericElement(element);
                                    if (!AutoNumericHelper.isNull(anObject)) {
                                        valueResult = this.unformat(element, anObject.getSettings());
                                    }
                                    break;
                                case 'localized':
                                    anObject = this.getAutoNumericElement(element);
                                    if (!AutoNumericHelper.isNull(anObject)) {
                                        // Here I need to clone the setting object, otherwise I would modify it when changing the `outputFormat` option value
                                        const currentSettings = AutoNumericHelper.cloneObject(anObject.getSettings());
                                        if (!AutoNumericHelper.isNull(forcedOutputFormat)) {
                                            currentSettings.outputFormat = forcedOutputFormat;
                                        }

                                        valueResult = this.localize(element, currentSettings);
                                    }
                                    break;
                                case 'formatted':
                                default:
                                    valueResult = element.value;
                            }
                        } else {
                            valueResult = element.value;
                        }

                        if (AutoNumericHelper.isUndefined(valueResult)) {
                            AutoNumericHelper.throwError('This error should never be hit. If it has, something really wrong happened!');
                        }

                        if (intoAnArray) {
                            result.push({ name: element.name, value: valueResult });
                        } else { // into a string
                            result.push(`${encodeURIComponent(element.name)}=${encodeURIComponent(valueResult)}`);
                        }
                    }
                }
            });
        }

        let finalResult;

        if (intoAnArray) {
            // Result as an Array
            // Note: `serializedSpaceCharacter` does not affect the array result since we do not change the space character for this one
            finalResult = result;
        } else {
            // Result as a string
            finalResult = result.join('&');

            if ('+' === serializedSpaceCharacter) {
                finalResult = finalResult.replace(/%20/g, '+');
            }
        }

        return finalResult;
    }

    /**
     * Serialize the form values to a string, outputting numeric strings for each AutoNumeric-managed element values.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @returns {string}
     */
    static _serializeNumericString(form, serializedSpaceCharacter = '+') {
        return this._serialize(form, false, 'unformatted', serializedSpaceCharacter);
    }

    /**
     * Serialize the form values to a string, outputting the formatted value as strings for each AutoNumeric-managed elements.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @returns {string}
     */
    static _serializeFormatted(form, serializedSpaceCharacter = '+') {
        return this._serialize(form, false, 'formatted', serializedSpaceCharacter);
    }

    /**
     * Serialize the form values to a string, outputting localized strings for each AutoNumeric-managed element values.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @param {string|null} forcedOutputFormat If set, then this is the format that is used for the localization, instead of the default `outputFormat` option.
     * @returns {string}
     */
    static _serializeLocalized(form, serializedSpaceCharacter = '+', forcedOutputFormat = null) {
        return this._serialize(form, false, 'localized', serializedSpaceCharacter, forcedOutputFormat);
    }

    /**
     * Generate an Array with the form values, outputting numeric strings for each AutoNumeric-managed element values.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @returns {Array}
     */
    static _serializeNumericStringArray(form, serializedSpaceCharacter = '+') {
        return this._serialize(form, true, 'unformatted', serializedSpaceCharacter);
    }

    /**
     * Generate an Array with the form values, outputting the formatted value as strings for each AutoNumeric-managed elements.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @returns {Array}
     */
    static _serializeFormattedArray(form, serializedSpaceCharacter = '+') {
        return this._serialize(form, true, 'formatted', serializedSpaceCharacter);
    }

    /**
     * Generate an Array with the form values, outputting localized strings for each AutoNumeric-managed element values.
     *
     * @param {HTMLFormElement} form
     * @param {string} serializedSpaceCharacter
     * @param {string|null} forcedOutputFormat If set, then this is the format that is used for the localization, instead of the default `outputFormat` option.
     * @returns {Array}
     */
    static _serializeLocalizedArray(form, serializedSpaceCharacter = '+', forcedOutputFormat = null) {
        return this._serialize(form, true, 'localized', serializedSpaceCharacter, forcedOutputFormat);
    }
}

/**
 * The defaults options.
 * These can be overridden by the following methods:
 * - HTML5 data attributes (ie. `<input type="text" data-currency-symbol=" €">`)
 * - Options passed to the `update` method (ie. `anElement.update({ currencySymbol: ' €' });`), or simply during the initialization (ie. `new AutoNumeric(domElement, {options});`)
 */
AutoNumeric.defaultSettings = {
    /* Allowed thousand grouping separator characters :
     * ','      // Comma
     * '.'      // Dot
     * ' '      // Normal space
     * '\u2009' // Thin-space
     * '\u202f' // Narrow no-break space
     * '\u00a0' // No-break space
     * ''       // No separator
     * "'"      // Apostrophe
     * '٬'      // Arabic thousands separator
     * '˙'      // Dot above
     */
    digitGroupSeparator: ',',

    /* Remove the thousand separator on focus, currency symbol and suffix on focus
     * example if the input value "$ 1,999.88 suffix"
     * on "focusin" it becomes "1999.88" and back to "$ 1,999.88 suffix" on focus out.
     */
    noSeparatorOnFocus: false,

    /* Digital grouping for the thousand separator used in Format
     * digitalGroupSpacing: "2", results in 99,99,99,999 India's lakhs
     * digitalGroupSpacing: "2s", results in 99,999,99,99,999 India's lakhs scaled
     * digitalGroupSpacing: "3", results in 999,999,999 default
     * digitalGroupSpacing: "4", results in 9999,9999,9999 used in some Asian countries
     */
    digitalGroupSpacing: '3',

    /* Allowed decimal separator characters :
     * ',' : Comma
     * '.' : Dot
     * '·' : Middle-dot
     * '٫' : Arabic decimal separator
     * '⎖' : Decimal separator key symbol
     */
    decimalCharacter: '.',

    /* Allow to declare an alternative decimal separator which is automatically replaced by `decimalCharacter` when typed.
     * This is used by countries that use a comma "," as the decimal character and have keyboards\numeric pads that have
     * a period 'full stop' as the decimal characters (France or Spain for instance).
     */
    decimalCharacterAlternative: null,

    /* currencySymbol = allowed currency symbol
     * Must be in quotes currencySymbol: "$"
     * space to the right of the currency symbol currencySymbol: '$ '
     * space to the left of the currency symbol currencySymbol: ' $'
     */
    currencySymbol: '',

    /* currencySymbolPlacement = placement of currency sign as a p=prefix or s=suffix
     * for prefix currencySymbolPlacement: "p" (default)
     * for suffix currencySymbolPlacement: "s"
     */
    //TODO Rename the options to more explicit names ('p' => 'prefix', etc.)
    currencySymbolPlacement: 'p',

    /* Placement of negative/positive sign relative to the currencySymbol option l=left, r=right, p=prefix & s=suffix
     * -1,234.56  => default no options required
     * -$1,234.56 => {currencySymbol: "$"} or {currencySymbol: "$", negativePositiveSignPlacement: "l"}
     * $-1,234.56 => {currencySymbol: "$", negativePositiveSignPlacement: "r"} // Default if negativePositiveSignPlacement is 'null' and currencySymbol is not empty
     * -1,234.56$ => {currencySymbol: "$", currencySymbolPlacement: "s", negativePositiveSignPlacement: "p"} // Default if negativePositiveSignPlacement is 'null' and currencySymbol is not empty
     * 1,234.56-  => {negativePositiveSignPlacement: "s"}
     * $1,234.56- => {currencySymbol: "$", negativePositiveSignPlacement: "s"}
     * 1,234.56-$ => {currencySymbol: "$", currencySymbolPlacement: "s"}
     * 1,234.56$- => {currencySymbol: "$", currencySymbolPlacement: "s", negativePositiveSignPlacement: "r"}
     */
    //TODO Rename the options to more explicit names ('p' => 'prefix', etc.)
    negativePositiveSignPlacement: null,


    /* Allow the positive sign symbol `+` to be displayed for positive numbers.
     * By default, this positive sign is not shown.
     * The sign placement is controlled by the 'negativePositiveSignPlacement' option, mimicking the negative sign placement rules.
     */
    showPositiveSign: false,

    /* Additional suffix
     * Must be in quotes suffixText: 'gross', a space is allowed suffixText: ' dollars'
     * Numeric characters and negative sign not allowed'
     */
    suffixText: '',

    /* Override min max limits
     * overrideMinMaxLimits: "ceiling" adheres to maximumValue and ignores minimumValue settings
     * overrideMinMaxLimits: "floor" adheres to minimumValue and ignores maximumValue settings
     * overrideMinMaxLimits: "ignore" ignores both minimumValue & maximumValue
     */
    overrideMinMaxLimits: null,

    /* Maximum possible value
     * value must be enclosed in quotes and use the period for the decimal point
     * value must be larger than minimumValue
     */
    maximumValue: '9999999999999.99', // 9.999.999.999.999,99 ~= 10000 billions

    /* Minimum possible value
     * value must be enclosed in quotes and use the period for the decimal point
     * value must be smaller than maximumValue
     */
    minimumValue: '-9999999999999.99', // -9.999.999.999.999,99 ~= 10000 billions

    /* Maximum number of decimal places = used to override decimal places set by the minimumValue & maximumValue values
     */
    decimalPlacesOverride: null,

    /* Expanded decimal places visible when input has focus - example:
     * {decimalPlacesShownOnFocus: "5"} and the default 2 decimal places with focus "1,000.12345" without focus "1,000.12" the results depends on the rounding method used
     * the "get" method returns the extended decimal places
     */
    decimalPlacesShownOnFocus: null,

    /* The next three options (scaleDivisor, scaleDecimalPlaces & scaleSymbol) handle scaling of the input when the input does not have focus
     * Please note that the non-scaled value is held in data and it is advised that you use the "saveValueToSessionStorage" option to ensure retaining the value
     * ["divisor", "decimal places", "symbol"]
     * Example: with the following options set {scaleDivisor: '1000', scaleDecimalPlaces: '1', scaleSymbol: ' K'}
     * Example: focusin value "1,111.11" focusout value "1.1 K"
     */

    /* The `scaleDivisor` decides the on focus value and places the result in the input on focusout
     * Example {scaleDivisor: '1000'} or <input data-scale-divisor="1000">
     * The divisor value - does not need to be whole number but please understand that Javascript has limited accuracy in math
     * The "get" method returns the full value, including the 'hidden' decimals.
     */
    scaleDivisor: null,

    /*
     * The `scaleDecimalPlaces` option is the number of decimal place when not in focus - for this to work, `scaledDivisor` must not be `null`.
     * This is optional ; if omitted the decimal places will be the same when the input has the focus.
     */
    scaleDecimalPlaces: null,

    /*
     * The `scaleSymbol` option is a symbol placed as a suffix when not in focus.
     * This is optional too.
     */
    scaleSymbol: null,

    /* Set to true to allow the decimalPlacesShownOnFocus value to be saved with sessionStorage
     * if ie 6 or 7 the value will be saved as a session cookie
     */
    saveValueToSessionStorage: false,

    /*
     * Manage how autoNumeric react when the user tries to paste an invalid number.
     * - 'error'    : (This is the default behavior) The input value is not changed and an error is output in the console.
     * - 'ignore'   : idem than 'error', but fail silently without outputting any error/warning in the console.
     * - 'clamp'    : if the pasted value is either too small or too big regarding the minimumValue and maximumValue range, then the result is clamped to those limits.
     * - 'truncate' : autoNumeric will insert as many pasted numbers it can at the initial caret/selection, until everything is pasted, or the range limit is hit.
     *                The non-pasted numbers are dropped and therefore not used at all.
     * - 'replace'  : autoNumeric will first insert as many pasted numbers it can at the initial caret/selection, then if the range limit is hit, it will try
     *                to replace one by one the remaining initial numbers (on the right side of the caret) with the rest of the pasted numbers.
     *
     * Note 1 : A paste content starting with a negative sign '-' will be accepted anywhere in the input, and will set the resulting value as a negative number
     * Note 2 : A paste content starting with a number will be accepted, even if the rest is gibberish (ie. '123foobar456').
     *          Only the first number will be used (here '123').
     * Note 3 : The paste event works with the `decimalPlacesShownOnFocus` option too.
     */
    //TODO Shouldn't we use `truncate` as the default value?
    onInvalidPaste: 'error',

    /* method used for rounding
     * roundingMethod: "S", Round-Half-Up Symmetric (default)
     * roundingMethod: "A", Round-Half-Up Asymmetric
     * roundingMethod: "s", Round-Half-Down Symmetric (lower case s)
     * roundingMethod: "a", Round-Half-Down Asymmetric (lower case a)
     * roundingMethod: "B", Round-Half-Even "Bankers Rounding"
     * roundingMethod: "U", Round Up "Round-Away-From-Zero"
     * roundingMethod: "D", Round Down "Round-Toward-Zero" - same as truncate
     * roundingMethod: "C", Round to Ceiling "Toward Positive Infinity"
     * roundingMethod: "F", Round to Floor "Toward Negative Infinity"
     * roundingMethod: "N05" Rounds to the nearest .05 => same as "CHF" used in 1.9X and still valid
     * roundingMethod: "U05" Rounds up to next .05
     * roundingMethod: "D05" Rounds down to next .05
     */
    //TODO Rename the options to more explicit names ('S' => 'RoundHalfUpSymmetric', etc.)
    //TODO Add an `an.roundingMethod` object that enum those options clearly
    roundingMethod: 'S',

    /* Allow padding the decimal places with zeros
     * allowDecimalPadding: true - always Pad decimals with zeros
     * allowDecimalPadding: false - does not pad with zeros.
     * Note: setting allowDecimalPadding to 'false' will override the 'decimalPlacesOverride' setting.
     *
     * thanks to Jonas Johansson for the suggestion
     */
    allowDecimalPadding: true,

    /* Adds brackets on negative values (ie. transforms '-$ 999.99' to '(999.99)')
     * Those brackets are visible only when the field does NOT have the focus.
     * The left and right symbols should be enclosed in quotes and separated by a comma
     * This option can be of the following values :
     * null, // This is the default value, which deactivate this feature
     * '(,)',
     * '[,]',
     * '<,>' or
     * '{,}'
     */
    //TODO Rename the options to more explicit names ('(,)' => 'parentheses', etc.)
    negativeBracketsTypeOnBlur: null,

    /* Displayed on empty string ""
     * emptyInputBehavior: "focus" - (default) currency sign displayed and the input receives focus
     * emptyInputBehavior: "press" - currency sign displays on any key being pressed
     * emptyInputBehavior: "always" - always displays the currency sign only
     * emptyInputBehavior: "zero" - if the input has no value on focus out displays a zero "rounded" with or without a currency sign
     */
    emptyInputBehavior: 'focus',

    /* Controls leading zero behavior
     * leadingZero: "allow", - allows leading zeros to be entered. Zeros will be truncated when entering additional digits. On focusout zeros will be deleted.
     * leadingZero: "deny", - allows only one leading zero on values less than one
     * leadingZero: "keep", - allows leading zeros to be entered. on focusout zeros will be retained.
     */
    leadingZero: 'deny',

    /* Determine if the default value will be formatted on initialization.
     * true = automatically formats the default value on initialization
     * false = will not format the default value on initialization
     */
    formatOnPageLoad: true,

    /* Determine if the select all keyboard command will select the complete input text, or only the input numeric value
     * Note : If the currency symbol is between the numeric value and the negative sign, only the numeric value will selected
     */
    selectNumberOnly: false,

    /* Helper option for ASP.NET postback
     * should be the value of the unformatted default value
     * examples:
     * no default value="" {defaultValueOverride: ""}
     * value=1234.56 {defaultValueOverride: '1234.56'}
     */
    defaultValueOverride: null,

    /* Removes formatting on submit event
     * this output format: positive nnnn.nn, negative -nnnn.nn
     * review the 'unSet' method for other formats
     */
    unformatOnSubmit: false,

    /* Defines how the value should be formatted when wanting a 'localized' version of it.
     * null or 'string' => 'nnnn.nn' or '-nnnn.nn' as text type. This is the default behavior.
     * 'number'         => nnnn.nn or -nnnn.nn as a Number (Warning: this works only for integers inferior to Number.MAX_SAFE_INTEGER)
     * ',' or '-,'      => 'nnnn,nn' or '-nnnn,nn'
     * '.-'             => 'nnnn.nn' or 'nnnn.nn-'
     * ',-'             => 'nnnn,nn' or 'nnnn,nn-'
     */
    outputFormat: null,

    /* Allow the user to 'cancel' and undo the changes he made to the given autonumeric-managed element, by pressing the 'Escape' key.
     * Whenever the user 'validate' the input (either by hitting 'Enter', or blurring the element), the new value is saved for subsequent 'cancellation'.
     *
     * The process :
     *   - save the input value on focus
     *   - if the user change the input value, and hit `Escape`, then the initial value saved on focus is set back
     *   - on the other hand if the user either have used `Enter` to validate (`Enter` throws a change event) his entries, or if the input value has been changed by another script in the mean time, then we save the new input value
     *   - on a successful 'cancel', select the whole value (while respecting the `selectNumberOnly` option)
     *   - bonus; if the value has not changed, hitting 'Esc' just select all the input value (while respecting the `selectNumberOnly` option)
     */
    isCancellable : true,

    /* Allow the user to increment or decrement the element value with the mouse wheel.
     * The wheel behavior can by modified by the `wheelStep` option.
     * This `wheelStep` options can be used in two ways, either by setting :
     * - a 'fixed' step value (`wheelStep : 1000`), or
     * - the 'progressive' string (`wheelStep : 'progressive'`), which will then activate a special mode where the step is automatically calculated based on the element value size.
     *
     * Note :
     * A special behavior is applied in order to avoid preventing the user to scroll the page if the inputs are covering the whole available space.
     * You can use the 'Shift' modifier key while using the mouse wheel in order to temporarily disable the increment/decrement feature (useful on small screen where some badly configured inputs could use all the available space).
     */
    modifyValueOnWheel : true,

    /* That option is linked to the `modifyValueOnWheel` one and will only be used if the latter is set to `true`.
     * This option will modify the wheel behavior and can be used in two ways, either by setting :
     * - a 'fixed' step value (a positive float or integer number `1000`), or
     * - the `'progressive'` string.
     *
     * The 'fixed' mode always increment/decrement the element value by that amount, while respecting the `minimumValue` and `maximumValue` settings.
     * The 'progressive' mode will increment/decrement the element value based on its current value. The bigger the number, the bigger the step, and vice versa.
     */
    wheelStep : 'progressive',

    /* Defines how the serialize functions should treat the spaces.
     * Those spaces ' ' can either be converted to the plus sign '+', which is the default, or to '%20'.
     * Both values being valid per the spec (http://www.w3.org/Addressing/URL/uri-spec.html).
     * Also see the summed up answer on http://stackoverflow.com/a/33939287.
     *
     * tl;dr : Spaces should be converted to '%20' before the '?' sign, then converted to '+' after.
     * In our case since we serialize the query, we use '+' as the default (but allow the user to get back the old *wrong* behavior).
     */
    serializeSpaces : '+',

    /* Defines if warnings should be shown
     * Error handling function
     * true => all warning are shown
     * false => no warnings are shown, only the thrown errors
     */
    showWarnings: true,

    /* Defines if the element should have event listeners activated on it.
     * By default, those event listeners are only added to <input> elements, but not on the other html tags.
     * This allows to initialize <input> elements without any event listeners.
     * Warning: Since AutoNumeric will not check the input content after its initialization, using some autoNumeric methods will probably leads to formatting problems.
     */
    noEventListeners: false,

    /* Defines if the <input> element should be set as read only on initialization.
     * When set to `true`, then the `readonly` html property is added to the <input> element on initialization.
     */
    readOnly: false,

    /* Defines if the element value should be unformatted when the user hover his mouse over it while holding the `Alt` key.
     * We reformat back before anything else if :
     * - the user focus on the element by tabbing or clicking into it,
     * - the user releases the `Alt` key, and
     * - if we detect a mouseleave event.
     *
     * We unformat again if :
     * - while the mouse is over the element, the user hit ctrl again
     */
    unformatOnHover: true,

    /*
     * This option is the 'strict mode' (aka 'debug' mode), which allows autoNumeric to strictly analyse the options passed, and fails if an unknown options is used in the settings object.
     * You should set that to 'TRUE' if you want to make sure you are only using 'pure' autoNumeric settings objects in your code.
     * If you see uncaught errors in the console and your code starts to fail, this means somehow those options gets corrupted by another program.
     */
    failOnUnknownOption: false,
};

/**
 * Options values enumeration
 */
AutoNumeric.options = {
    digitGroupSeparator          : {
        comma                   : ',',
        dot                     : '.',
        normalSpace             : ' ',
        thinSpace               : '\u2009',
        narrowNoBreakSpace      : '\u202f',
        noBreakSpace            : '\u00a0',
        noSeparator             : '',
        apostrophe              : "'",
        arabicThousandsSeparator: '٬',
        dotAbove                : '˙',
    },
    noSeparatorOnFocus           : {
        noSeparator  : true,
        withSeparator: false,
    },
    digitalGroupSpacing          : {
        default: '3',
    },
    decimalCharacter             : {
        comma                    : ',',
        dot                      : '.',
        middleDot                : '·',
        arabicDecimalSeparator   : '٫',
        decimalSeparatorKeySymbol: '⎖',
    },
    decimalCharacterAlternative  : {
        none: null,
    },
    // cf. https://en.wikipedia.org/wiki/Currency_symbol
    currencySymbol               : {
        default       : '',
        currencySign  : '¤',
        austral       : '₳', // ARA
        australCentavo: '¢',
        baht          : '฿', // THB
        cedi          : '₵', // GHS
        cent          : '¢',
        colon         : '₡', // CRC
        cruzeiro      : '₢', // BRB
        dollar        : '$',
        dong          : '₫', // VND
        drachma       : '₯', // GRD (or 'Δρχ.' or 'Δρ.')
        lepton        : 'Λ.', // cents of the Drachma
        dram          : '​֏', // AMD
        european      : '₠', // XEU (old currency before the Euro)
        euro          : '€', // EUR
        florin        : 'ƒ',
        franc         : '₣', // FRF
        guarani       : '₲', // PYG
        hryvnia       : '₴', // грн
        kip           : '₭', // LAK
        att           : 'ອັດ', // cents of the Kip
        lira          : '₺', // TRY
        liraOld       : '₤',
        lari          : '₾', // GEL
        mark          : 'ℳ',
        pfennig       : '₰', // cents of the Mark
        mill          : '₥',
        naira         : '₦', // NGN
        peseta        : '₧',
        peso          : '₱', // PHP
        pound         : '£',
        riel          : '៛', // KHR
        ruble         : '₽', // RUB
        rupee         : '₹', // INR
        rupeeOld      : '₨',
        shekel        : '₪',
        shekelAlt     : 'ש״ח‎‎',
        taka          : '৳', // BDT
        tenge         : '₸', // KZT
        togrog        : '₮', // MNT
        won           : '₩',
        yen           : '¥',
    },
    currencySymbolPlacement      : {
        prefix: 'p',
        suffix: 's',
    },
    negativePositiveSignPlacement: {
        prefix: 'p',
        suffix: 's',
        left  : 'l',
        right : 'r',
        none  : null,
    },
    showPositiveSign             : {
        show: true,
        hide: false,
    },
    suffixText                   : {
        default: '',
    },
    overrideMinMaxLimits         : {
        ceiling      : 'ceiling',
        floor        : 'floor',
        ignore       : 'ignore',
        doNotOverride: null,
    },
    maximumValue                 : {
        default: '9999999999999.99',
    },
    minimumValue                 : {
        default: '-9999999999999.99',
    },
    decimalPlacesOverride        : {
        default: null,
    },
    decimalPlacesShownOnFocus    : {
        default: null,
    },
    scaleDivisor                 : {
        default: null,
    },
    scaleDecimalPlaces           : {
        default: null,
    },
    scaleSymbol                  : {
        default: null,
    },
    saveValueToSessionStorage    : {
        save     : true,
        doNotSave: false,
    },
    onInvalidPaste               : {
        error   : 'error',
        ignore  : 'ignore',
        clamp   : 'clamp',
        truncate: 'truncate',
        replace : 'replace',
    },
    roundingMethod               : {
        halfUpSymmetric                : 'S',
        halfUpAsymmetric               : 'A',
        halfDownSymmetric              : 's',
        halfDownAsymmetric             : 'a',
        halfEvenBankersRounding        : 'B',
        upRoundAwayFromZero            : 'U',
        downRoundTowardZero            : 'D',
        toCeilingTowardPositiveInfinity: 'C',
        toFloorTowardNegativeInfinity  : 'F',
        toNearest05                    : 'N05', // also 'CHF'
        upToNext05                     : 'U05',
        downToNext05                   : 'D05',
    },
    allowDecimalPadding          : {
        padding  : true,
        noPadding: false,
    },
    negativeBracketsTypeOnBlur   : {
        parentheses: '(,)',
        brackets   : '[,]',
        chevrons   : '<,>',
        curlyBraces: '{,}',
        none       : null,
    },
    emptyInputBehavior           : {
        focus : 'focus',
        press : 'press',
        always: 'always',
        zero  : 'zero',
    },
    leadingZero                  : {
        allow: 'allow',
        deny : 'deny',
        keep : 'keep',
    },
    formatOnPageLoad             : {
        format     : true,
        doNotFormat: false,
    },
    selectNumberOnly             : {
        selectNumbersOnly: true,
        selectAll        : false,
    },
    defaultValueOverride         : {
        default: null,
    },
    unformatOnSubmit             : {
        unformat        : true,
        keepCurrentValue: false,
    },
    outputFormat                 : {
        string       : 'string',
        number       : 'number',
        dot          : '.',
        negativeDot  : '-.',
        comma        : ',',
        negativeComma: '-,',
        dotNegative  : '.-',
        commaNegative: ',-',
        none         : null,
    },
    isCancellable                : {
        cancellable   : true,
        notCancellable: false,
    },
    modifyValueOnWheel           : {
        modifyValue: true,
        doNothing  : false,
    },
    wheelStep                    : {
        progressive: 'progressive',
    },
    serializeSpaces              : {
        plus   : '+',
        percent: '%20',
    },
    showWarnings                 : {
        show: true,
        hide: false,
    },
    noEventListeners             : {
        noEvents : true,
        addEvents: false,
    },
    readOnly                     : {
        readOnly : true,
        readWrite: false,
    },
    unformatOnHover              : {
        unformat     : true,
        doNotUnformat: false,
    },
    failOnUnknownOption          : {
        fail  : true,
        ignore: false,
    },
};


/**
 * Predefined options for the most common languages
 */
const defaultMinimumValue     = '-999999999999.99';
const defaultMaximumValue     = '999999999999.99';
const defaultRoundingMethod   = AutoNumeric.options.roundingMethod.upRoundAwayFromZero;
const defaultLeadingZero      = AutoNumeric.options.leadingZero.deny;
const defaultSelectNumberOnly = true;
AutoNumeric.languageOptions = {
    French       : { // Français
        digitGroupSeparator          : '.', // or '\u202f'
        decimalCharacter             : ',',
        decimalCharacterAlternative  : '.',
        currencySymbol               : '\u202f€',
        currencySymbolPlacement      : AutoNumeric.options.currencySymbolPlacement.suffix,
        negativePositiveSignPlacement: AutoNumeric.options.negativePositiveSignPlacement.prefix,
        selectNumberOnly             : defaultSelectNumberOnly,
        roundingMethod               : defaultRoundingMethod,
        leadingZero                  : defaultLeadingZero,
        minimumValue                 : defaultMinimumValue,
        maximumValue                 : defaultMaximumValue,
    },
    NorthAmerican: {
        digitGroupSeparator          : ',',
        decimalCharacter             : '.',
        currencySymbol               : '$',
        currencySymbolPlacement      : AutoNumeric.options.currencySymbolPlacement.prefix,
        negativePositiveSignPlacement: AutoNumeric.options.negativePositiveSignPlacement.right,
        selectNumberOnly             : defaultSelectNumberOnly,
        roundingMethod               : defaultRoundingMethod,
        leadingZero                  : defaultLeadingZero,
        minimumValue                 : defaultMinimumValue,
        maximumValue                 : defaultMaximumValue,
    },
    British      : {
        digitGroupSeparator          : ',',
        decimalCharacter             : '.',
        currencySymbol               : '£',
        currencySymbolPlacement      : AutoNumeric.options.currencySymbolPlacement.prefix,
        negativePositiveSignPlacement: AutoNumeric.options.negativePositiveSignPlacement.right,
        selectNumberOnly             : defaultSelectNumberOnly,
        roundingMethod               : defaultRoundingMethod,
        leadingZero                  : defaultLeadingZero,
        minimumValue                 : defaultMinimumValue,
        maximumValue                 : defaultMaximumValue,
    },
    Swiss        : { // Suisse
        digitGroupSeparator          : `'`,
        decimalCharacter             : '.',
        currencySymbol               : '\u202fCHF',
        currencySymbolPlacement      : AutoNumeric.options.currencySymbolPlacement.suffix,
        negativePositiveSignPlacement: AutoNumeric.options.negativePositiveSignPlacement.prefix,
        selectNumberOnly             : defaultSelectNumberOnly,
        roundingMethod               : defaultRoundingMethod,
        leadingZero                  : defaultLeadingZero,
        minimumValue                 : defaultMinimumValue,
        maximumValue                 : defaultMaximumValue,
    },
    Japanese     : { // 日本語
        digitGroupSeparator          : ',',
        decimalCharacter             : '.',
        currencySymbol               : '¥',
        currencySymbolPlacement      : AutoNumeric.options.currencySymbolPlacement.prefix,
        negativePositiveSignPlacement: AutoNumeric.options.negativePositiveSignPlacement.right,
        selectNumberOnly             : defaultSelectNumberOnly,
        roundingMethod               : defaultRoundingMethod,
        leadingZero                  : defaultLeadingZero,
        minimumValue                 : defaultMinimumValue,
        maximumValue                 : defaultMaximumValue,
    },
};
AutoNumeric.languageOptions.Spanish = AutoNumeric.languageOptions.French; // Español (idem French)
AutoNumeric.languageOptions.Chinese = AutoNumeric.languageOptions.Japanese; // 中国語 (Chinese)

/**
 * Initialize multiple DOM elements in one call (and possibly pass multiple values that will be mapped to each DOM element).
 *
 * @param {string|Array|{ rootElement: HTMLElement }|{ rootElement: HTMLElement, exclude: Array<HTMLInputElement>}} arg1
 * @param {number|Array|object|null} initialValue
 * @param {object|null} options
 * @returns {Array}
 */
AutoNumeric.multiple = (arg1, initialValue = null, options = null) => {
    const result = [];

    // Analyze the arguments and transform them to make them exploitable
    if (AutoNumericHelper.isObject(initialValue)) {
        // If the user gave an option object as the second argument, instead of the initial values
        options = initialValue;
        initialValue = null;
    }

    if (AutoNumericHelper.isString(arg1)) {
        arg1 = [... document.querySelectorAll(arg1)]; // Convert a NodeList to an Array (cf. http://stackoverflow.com/a/37297292/2834898)
    } else if (AutoNumericHelper.isObject(arg1)) {
        if (!arg1.hasOwnProperty('rootElement')) {
            AutoNumericHelper.throwError(`The object passed to the 'multiple' function is invalid ; no 'rootElement' attribute found.`);
        }

        // Retrieve the DOM element list from the given <form> element
        const elements = [... arg1.rootElement.querySelectorAll('input')];
        if (arg1.hasOwnProperty('exclude')) {
            if (!Array.isArray(arg1.exclude)) {
                AutoNumericHelper.throwError(`The 'exclude' array passed to the 'multiple' function is invalid.`);
            }

            // Filter out the excluded elements
            arg1 = AutoNumericHelper.filterOut(elements, arg1.exclude);
        } else {
            arg1 = elements;
        }
    } else if (!AutoNumericHelper.isArray(arg1)) {
        AutoNumericHelper.throwError(`The given parameters to the 'multiple' function are invalid.`);
    }

    if (arg1.length === 0) {
        AutoNumericHelper.warning(`No valid DOM elements were given hence no AutoNumeric object were instantiated.`);
        return [];
    }

    // Initialize the initial values
    const isInitialValueArray = AutoNumericHelper.isArray(initialValue);
    const isInitialValueNumber = AutoNumericHelper.isNumber(initialValue);
    let initialValueArraySize;
    if (isInitialValueArray) {
        initialValueArraySize = initialValue.length;
    }

    // Instantiate each AutoNumeric objects
    arg1.forEach((domElement, index) => {
        if (isInitialValueNumber) {
            // We set the same value for each elements
            result.push(new AutoNumeric(domElement, initialValue, options));
        } else if (isInitialValueArray && index <= initialValueArraySize) {
            result.push(new AutoNumeric(domElement, initialValue[index], options));
        } else {
            result.push(new AutoNumeric(domElement, null, options));
        }
    });

    return result;
};

/**
 * Polyfill from https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent for obsolete browsers (IE)
 * //TODO Make sure we call that at least once when loading the AutoNumeric library
 */
(function() {
if (typeof window.CustomEvent === 'function') {
    return false;
}

function CustomEvent(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: void(0) };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
}

CustomEvent.prototype = window.Event.prototype;
window.CustomEvent = CustomEvent;
})();


/**
 * //XXX This is needed in order to get direct access to the `AutoNumeric` constructor without having to use `new AutoNumeric.default()` (cf. http://stackoverflow.com/a/36389244/2834898) : using `export var __useDefault = true;` does not work though.
 * //XXX The workaround (using `module.exports = AutoNumeric` instead of `export default class AutoNumeric {}`) comes from https://github.com/webpack/webpack/issues/706#issuecomment-167908576
 * //XXX And the explanation why Babel 6 changed the way Babel 5 worked : http://stackoverflow.com/a/33506169/2834898
 * //XXX Ideally, we should be able to just declare `export default class AutoNumeric {}` in the future, and remove the following `module.exports = AutoNumeric;` line
 *
 * @type {AutoNumeric}
 */
module.exports = AutoNumeric;