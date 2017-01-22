/*! svg4everybody v2.1.4 | github.com/jonathantneal/svg4everybody */
/*
** errors in the original code
** uses cloneNode instead of importNode which adjusts for relative paths
**	except importNode doesn't adjust relative paths for xlink:href in <use> elements
** doesn't preserve the additional properties on the <use> elements
**	which provide default fill's, stroke's, and transforms
*/
var LEGACY_SUPPORT = false
function embed(root, parent, svg, target, attrlist) {
    // if the target exists
    if (target) {
	// create a document fragment to hold the contents of the target
	var fragment = document.createDocumentFragment();

	// cache the closest matching viewBox
	var viewBox = !svg.hasAttribute('viewBox') && target.getAttribute('viewBox');

	// conditionally set the viewBox on the svg
	if (viewBox) {
	    svg.setAttribute('viewBox', viewBox);
	}

	// clone the target
	var clone = document.importNode(target, true);
	while (attrlist.length > 0) {
	    let name = attrlist.shift()
	    let value = attrlist.shift()
	    clone.setAttribute(name, value)
	}
	// copy the contents of the clone into the fragment
	while (clone.childNodes.length) {
	    fragment.appendChild(clone.firstChild);
	}
	// append the fragment into the svg
	parent.appendChild(fragment);
    }
}

function loadreadystatechange(xhr, root) {
    // listen to changes in the request
    xhr.onreadystatechange = function () {
	// if the request is ready
	if (xhr.readyState === 4) {
	    // get the cached html document
	    var cachedDocument = xhr._cachedDocument;

	    // ensure the cached html document based on the xhr response
	    if (!cachedDocument) {
		cachedDocument = xhr._cachedDocument = document.implementation.createHTMLDocument('');

		cachedDocument.body.innerHTML = xhr.responseText;

		xhr._cachedTarget = {};
	    }

	    // clear the xhr embeds list and embed each item
	    xhr._embeds.splice(0).map(function (item) {
		// get the cached target
		var target = xhr._cachedTarget[item.id];

		// ensure the cached target
		if (!target) {
		    target = xhr._cachedTarget[item.id] = cachedDocument.getElementById(item.id);
		}
		console.log("going to embed clone of "+item.id)
		// embed the target into the svg
		embed(root, item.parent, item.svg, target, item.stuff);
	    });
	}
    };

    // test the ready state change immediately
    xhr.onreadystatechange();
}

function svg4everybody(root, rawopts) {
    var opts = Object(rawopts);

    // create legacy support variables
    var nosvg;
    var fallback;

    // if running with legacy support
    if (LEGACY_SUPPORT) {
	// configure the fallback method
	fallback = opts.fallback || function (src) {
	    return src.replace(/\?[^#]+/, '').replace('#', '.').replace(/^\./, '') + '.png' + (/\?[^#]+/.exec(src) || [''])[0];
	};

	// set whether to shiv <svg> and <use> elements and use image fallbacks
	nosvg = 'nosvg' in opts ? opts.nosvg : /\bMSIE [1-8]\b/.test(navigator.userAgent);

	// conditionally shiv <svg> and <use>
	if (nosvg) {
	    root.createElement('svg');
	    root.createElement('use');
	}
    }

    // set whether the polyfill will be activated or not
    var polyfill;
    var olderIEUA = /\bMSIE [1-8]\.0\b/;
    var newerIEUA = /\bTrident\/[567]\b|\bMSIE (?:9|10)\.0\b/;
    var webkitUA = /\bAppleWebKit\/(\d+)\b/;
    var olderEdgeUA = /\bEdge\/12\.(\d+)\b/;

    if ('polyfill' in opts) {
	polyfill = opts.polyfill;
    } else if (LEGACY_SUPPORT) {
	polyfill = olderIEUA.test(navigator.userAgent) || newerIEUA.test(navigator.userAgent) || (navigator.userAgent.match(olderEdgeUA) || [])[1] < 10547 || (navigator.userAgent.match(webkitUA) || [])[1] < 537;
    } else {
	polyfill = newerIEUA.test(navigator.userAgent) || (navigator.userAgent.match(olderEdgeUA) || [])[1] < 10547 || (navigator.userAgent.match(webkitUA) || [])[1] < 537;
    }

    // create xhr requests object
    var requests = {};

    // use request animation frame or a timeout to search the dom for svgs
    var requestAnimationFrame = window.requestAnimationFrame || setTimeout;

    // get a live collection of use elements on the page
    var uses = root.getElementsByTagName('use');

    function oninterval() {
	// get the cached <use> index
	var index = 0;

	// while the index exists in the live <use> collection
	while (index < uses.length) {
	    // get the current <use>
	    var use = uses[index];

	    // get the current <svg>
	    var parent = use.parentNode;
	    var svg = getSVGAncestor(parent);

	    if (svg) {
		var src = use.getAttribute('xlink:href') || use.getAttribute('href');

		// if running with legacy support
		if (LEGACY_SUPPORT && nosvg) {
		    // create a new fallback image
		    var img = root.createElement('img');

		    // force display in older IE
		    img.style.cssText = 'display:inline-block;height:100%;width:100%';

		    // set the fallback size using the svg size
		    img.setAttribute('width', svg.getAttribute('width') || svg.clientWidth);
		    img.setAttribute('height', svg.getAttribute('height') || svg.clientHeight);

		    // set the fallback src
		    img.src = fallback(src, svg, use);

		    // replace the <use> with the fallback image
		    parent.replaceChild(img, use);
		} else if (polyfill) {
		    if (!opts.validate || opts.validate(src, svg, use)) {
			// remove the <use> element
			parent.removeChild(use);

			// parse the src and get the url and id
			var srcSplit = src.split('#');
			var url = srcSplit.shift();
			var id = srcSplit.join('#');
			console.log("svg fetching "+url+"#"+id)

			// if the link is external
			if (url.length) {
			    // get the cached xhr request
			    var xhr = requests[url];

			    // ensure the xhr request exists
			    if (!xhr) {
				xhr = requests[url] = new XMLHttpRequest();

				xhr.open('GET', url);

				xhr.send();

				xhr._embeds = [];
			    }

			    // check for additional attributes
			    let stuff = []
			    if (use.hasAttributes()) {
				let attrs = use.attributes
				for (let i = 0; i < attrs.length; i += 1)
				    if (attrs[i].name !== 'xlink:href')
					stuff.push(attrs[i].name, attrs[i].value)
			    }
			    // add the svg and id as an item to the xhr embeds list
			    xhr._embeds.push({
				parent: parent,
				svg: svg,
				id: id,
				stuff: stuff
			    });

			    // prepare the xhr ready state change event
			    loadreadystatechange(xhr, root);
			} else {
			    // embed the local id into the svg
			    console.log("losing by looking for local: "+id)
			    // embed(root, parent, document.getElementById(id));
			}
		    }
		}
	    } else {
		// increase the index when the previous value was not "valid"
		++index;
	    }
	}

	// continue the interval
	requestAnimationFrame(oninterval, 67);
    }

    // conditionally start the interval if the polyfill is active
    if (polyfill) {
	oninterval();
    }
}

function getSVGAncestor(node) {
    var svg = node;
    while (svg.nodeName.toLowerCase() !== 'svg') {
	svg = svg.parentNode;
	if (!svg) {
	    break;
	}
    }
    return svg;
}
