/*
 * RD SmoothScroll.
 *
 * @author Evgeniy Gusarov (Stmechanus | Diversant)
 * @license The MIT License (MIT)
 * @version: 1.0.0
 */
;
(function (window, document, undefined) {
    "use strict";

    var isTouch = "ontouchstart" in window,
        isMac = window.navigator.platform === 'MacIntel' || window.navigator.platform === 'MacPPC';

    /*
     * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
     */
    window.requestAnimFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    window.RDSmoothScroll = function (options) {
        /**
         * Current options set by the caller including defaults.
         * @public
         */
        this.options = RDSmoothScroll.Defaults;

        /**
         * Collects an array of elements with the smooth scroll shell
         * @private
         */
        this.animators = [];

        this.initialize();
    };

    RDSmoothScroll.Defaults = {
        friction: 0.88,
        step: isMac? 0.65 : 2,
        minDistance: 0.1
    };

    /**
     * Animator object constructor
     * @protected
     */
    RDSmoothScroll.Animator = function (element) {
        var originalTarget = element;
        if (element.nodeName.toLowerCase() === "html") {
            originalTarget = this.scrollableRoot();
        }
        this.target = element;
        this.originalTarget = originalTarget;
        this.direction = undefined;
        this.currentY = originalTarget.scrollTop;
        this.targetY = originalTarget.scrollTop;
        this.lastY = originalTarget.scrollTop;
        this.delta = 0;
        this.minY = 0;
        this.maxY = undefined;
        this.isPlaying = false;
        this.speed = 0;
    };

    /**
     * Get root element that can be scrolled
     * @protected
     */
    RDSmoothScroll.Animator.prototype.scrollableRoot = function () {
        var initialScrollTop = document.documentElement.scrollTop;

        if (initialScrollTop > 1) {
            document.documentElement.scrollTop -= 1;
        } else {
            document.documentElement.scrollTop += 1;
        }

        // If documentElement can't be scrolled, use fallback
        if (initialScrollTop === document.documentElement.scrollTop) {
            return document.body;
        }

        // If documentElement _was_ scrolled, reset to its initial position
        // if page hasn't already been scrolled
        if (Math.abs(document.documentElement.scrollTop - initialScrollTop) === 1) {
            document.documentElement.scrollTop = initialScrollTop;
        }

        return document.documentElement;
    };

    /**
     * Updates the animator states
     * @protected
     */
    RDSmoothScroll.Animator.prototype.update = function (e) {
        var ins = window.RDSmoothScroll.instance,
            delta = e.detail ? e.detail * -1 : e.wheelDelta / 40,
            dir = delta < 0 ? -1 : 1;

        if (dir != this.direction) {
            this.speed = 0;
            this.direction = dir;
        }

        this.currentY = -this.originalTarget.scrollTop;
        this.delta = delta;
        this.targetY += delta;
        this.speed += (this.targetY - this.lastY) * ins.options.step;
        this.lastY = this.targetY;
        this.start();
    };

    /**
     * Starts the animation
     * @protected
     */
    RDSmoothScroll.Animator.prototype.start = function () {
        if (!this.isPlaying) {
            this.isPlaying = true;

            //Stop any jQuery animation
            if (window.jQuery) {
                window.jQuery(this.originalTarget).stop();
            }

            this.play();
        }
    };

    /**
     * Triggers the animation loop
     * @protected
     */
    RDSmoothScroll.Animator.prototype.play = function () {
        var _this = this;
        if (!this.isPlaying)return;
        requestAnimFrame(function () {
            _this.play();
        });
        this.render();
    };

    /**
     * Stops the animation
     * @protected
     */
    RDSmoothScroll.Animator.prototype.stop = function () {
        if (this.isPlaying) {
            this.speed = 0;
            this.isPlaying = false;
        }
    };

    /**
     * Renders the animation frame
     * @protected
     */
    RDSmoothScroll.Animator.prototype.render = function () {
        var ins = window.RDSmoothScroll.instance;

        // Another scroll handler was triggered
        if (Math.abs(this.originalTarget.scrollTop - (-this.currentY)) > Math.abs(this.delta)
            && Math.abs(this.originalTarget.scrollTop - (-this.currentY)) > 1) {
            this.stop();
        }

        if (this.speed < -(ins.options.minDistance) || this.speed > ins.options.minDistance) {

            this.currentY = (this.currentY + this.speed);
            if (this.currentY > this.minY) {
                this.currentY = this.speed = 0;
            } else if (this.currentY < this.maxY) {
                this.speed = 0;
                this.currentY = this.maxY;
            }

            this.originalTarget.scrollTop = -this.currentY;

            this.speed *= ins.options.friction;
        } else {
            this.stop();
        }
    };

    /**
     * Initialize the engine.
     * @protected
     */
    RDSmoothScroll.prototype.initialize = function () {
        window.addEventListener('mousewheel', this.onWheel);
        window.addEventListener('DOMMouseScroll', this.onWheel);
    };

    /**
     * Checks for the animator instance on wheel
     * @protected
     */
    RDSmoothScroll.prototype.onWheel = function (e) {
        if (e.ctrlKey) {
            return;
        }

        var ins = window.RDSmoothScroll.instance,
            o, animator;

        e.preventDefault();

        o = e.target;

        while (o !== null) {
            if (o.nodeName.toLocaleLowerCase() == "html") {
                break;

            }
            else if (
                ((window.getComputedStyle(o).getPropertyValue('overflow') == 'auto')
                || (window.getComputedStyle(o).getPropertyValue('overflow') == 'scroll'))
                && (o.scrollHeight > o.clientHeight)
                && (o.clientHeight > 0)
            ) {
                break;
            }
            o = o.parentNode;
        }
        if (o == null) return;

        if (!ins.isAnimator(o)) {
            animator = ins.createAnimator(o);
        } else {
            animator = ins.getAnimator(o);
        }

        for (var i in ins.animators) {
            if (ins.animators[i] !== animator) {
                if (ins.animators[i].stop) {
                    ins.animators[i].stop();
                }
            }
        }

        animator.update(e);
    };

    /**
     * Creates an instance of smooth scrolling element
     * @protected
     */
    RDSmoothScroll.prototype.createAnimator = function (element) {
        return this.animators[this.animators.push(new RDSmoothScroll.Animator(element)) - 1];
    };

    /**
     * Checks the element is an animator
     * @protected
     */
    RDSmoothScroll.prototype.isAnimator = function (element) {
        for (var i in this.animators) {
            if (this.animators[i].target === element) {
                return true;
            }
        }
        return false;
    };

    /**
     * Returns the animator instance of element
     * @protected
     */
    RDSmoothScroll.prototype.getAnimator = function (element) {
        for (var i in this.animators) {
            if (this.animators[i].target === element) {
                return this.animators[i];
            }
        }
        return undefined;
    };

    /**
     * Create smooth scroll engine instance.
     */
    if (!isTouch) {
        window.RDSmoothScroll.instance = new RDSmoothScroll();
    }
})(window, document);
