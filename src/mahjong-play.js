function MahjongPrefs(root) {
    var prefs = {
	// option file ? may not make any sense
	// option directory ? ditto
	save_prefs: function(array) {
	},
	load_prefs: function() {
	},
	save_scores: function(list) {
	},
	load_scores: function() {
	}
    }
    return prefs
}

function MahjongLayout(root, map) {
    // better to just use [x,y,z] = slot
    function slot_x(slot) { return slot[0] }
    function slot_y(slot) { return slot[1] }
    function slot_z(slot) { return slot[2] }
    function slot_string(slot) { return slot.join(",") }
    function xy_set_string(set) { return "["+set.map((s) => slot_string(s.slice(0,2))).join("; ")+"]" }
    function slot_set_string(set) { return "["+set.map((s) => slot_string(s)).join("; ")+"]" }

    var slots = []
    var layers = []
    var width = 11
    var height = 7

    var layout = {
	// as a associative array over list values, uses the list pointer as index, cough, cough
	layout: new Map(),
	set: function(xyz, tag, val) {
	    if ( ! this.layout.has(xyz)) this.layout.set(xyz, new Map([["slot", null]]));
	    this.layout.get(xyz).set(tag, val);
	},
	get: function(xyz, tag) {
	    return this.layout.get(xyz).get(tag)
	},
	exists: function(xyz, tag) {
	    return this.layout.has(xyz) && this.layout.get(xyz).has(tag)
	},
	contains: function(xyz, tag, val) {
	    if ( ! this.exists(xyz, tag)) this.set(xyz, tag, [])
	    return this.get(xyz,tag).indexOf(val) >= 0
	},
	lappend: function(xyz, tag, val) {
	    if ( ! this.exists(xyz, tag)) this.set(xyz, tag, [])
	    this.get(xyz,tag).push(val);
	},
	string : (xyz) => slot_string(xyz),
	// maintaining the primary slot in the layout
	// this is the only one that changes after the layout is setup
	// note that slot is always xyz
	set_slot : function(slot, val) { this.set(slot, "slot", val) },
	get_slot : function(slot) { return this.get(slot, "slot") },
	exists_slot : function(slot) { return this.exists(slot, "slot") },
	set_empty : function(slot) { this.set_slot(slot, null) },
	is_empty : function(slot) { return this.get_slot(slot) == null },
	is_filled : function(slot) { return this.get_slot(slot) != null },
	is_endcap : function(xyz) { return this.get(xyz, "endcap") },
	is_naked_endcap : function(xyz) { return this.get(xyz, "naked-endcap") },

	// get all of the slots in render order
	// ie, those which are obscured are drawn before those which obscure
	get_slots : function() { return slots },
	// find the slots in a z layer in render order
	layer_slots : function(z) { return layers[z] || [] },
	// expand the layout map description
	expand_layout : function(part) {
	    if (part.type === "tile") {
		let row = [this.add_tile(part.x, part.y, part.z)]
		this.add_row(row)
		this.add_block(row)
	    } else if (part.type === "row") {
		let row = []
		for (let x = part.right; x >= part.left; x -= 1) {
		    row.push(this.add_tile(x, part.y, part.z))
		}
		this.add_row(row)
		this.add_block(row)
	    } else if (part.type === "block") {
		let block = []
		for (let y = part.top; y <= part.bottom; y += 1) {
		    let row = []
		    for (let x = part.right; x >= part.left; x -= 1) {
			row.push(this.add_tile(x, y, part.z))
		    }
		    this.add_row(row)
		    for (t of row) block.push(t)
		}
		this.add_block(block)
	    } else { 
		throw("what is "+ part.type +" doing in the map?")
	    }
	},

	// add the list of slots in a row
	add_row : function(row) { for (slot of row) this.set(slot, "row", row) },
	// add the list of slots in a block
	add_block : function(block) { for (slot of block) this.set(slot, "block", block) },
	// mark two cells as x-adjacent, need x-left-adjacent and x-right-adjacent, too
	add_x_adjacent : function (xyz, xnynzn) { this.add_symmetric("x-adjacent", xyz, xnynzn) },
	// record a symmetric relation
	add_symmetric : function(relation, slot1, slot2) {
	    if ( ! this.contains(slot1, relation, slot2)) { this.lappend(slot1, relation, slot2) }
	    if ( ! this.contains(slot2, relation, slot1)) { this.lappend(slot2, relation, slot1) }
	},
	// an antisymmetric relation
	add_left_adjacent : function(slot1, slot2) {
	    if ( ! this.contains(slot1, "left-adjacent", slot2)) { this.lappend(slot1, "left-adjacent", slot2) }
	    if ( ! this.contains(slot2, "right-adjacent", slot1)) { this.lappend(slot2, "right-adjacent", slot1) }
	},
	add_right_adjacent : function(slot1, slot2) { this.add_left_adjacent(slot2, slot1) },
	
	// add a new tile to the layout
	add_tile : function(x, y, z) {
	    // canonicalize the coordinates
	    // trouble with x, y in double vs integer as dictionary keys
	    // set x [expr {double($x)}]
	    // set y [expr {double($y)}]
	    // set z [expr {int($z)}]
	    // if {$options(-verbose) > 5} { puts "add-tile $x $y $z" }
	    let xyz = [x, y, z]
	    // initialize slot
	    this.set_slot(xyz, null)
	    for (let [tag, val] of [
		["z-shadow", []],
		["x-adjacent", []],
		["x-closure", []],
		["left-adjacent", []],
		["right-adjacent", []],
		["endcap", false],
		["naked-endcap", false],
		["triple-point", false],
		["row-closure", []],
		["left-closure", []],
		["right-closure", []]
	    ]) {
		this.set(xyz, tag, val)
	    }
	    slots.push(xyz)
	    if (z >= layers.length) layers.push([])
	    layers[z].push(xyz)
	    return xyz
	},

	slots_to_string : function(ss) {
	    return "["+ss.map(s => s.join(",")).join("][")+"]"
	},
	// find a slot with the given x, y, z
	// we use slots, the array of x, y, z coordinates, as a unique identifier
	// so a new array of the same x, y, z does not register as equal
	find_slot : function(x1,y1,z1) {
	    function slot_equal(s) {
		let [x2,y2,z2] = s
		let abs = (x) => Math.abs(x)
		return abs(x1-x2) < 0.25 && abs(y1-y2) < 0.25
	    }
	    for (let s of layers[z1]) if (slot_equal(s)) return s
	    return null
	},
	// compute the x-adjacent set of the tile
	compute_x_adjacent : function(xyz) {
	    let [x, y, z] = xyz
	    for (dx of [-1, 1]) {
		let xn = x+dx
		for (dy of [-0.5, 0, 0.5]) {
		    let yn = y+dy
		    let xnynzn = this.find_slot(xn, yn, z)
		    if (xnynzn == null) continue
		    if ( ! this.exists_slot(xnynzn)) continue
		    this.add_x_adjacent(xyz,xnynzn)
		    if (xn-x < 0) this.add_left_adjacent(xyz, xnynzn)
		    else this.add_right_adjacent(xyz, xnynzn)
		}
	    }
	    if (this.left_adjacent(xyz).length == 0 || this.right_adjacent(xyz).length == 0) {
		this.set(xyz, "endcap", true)
		if ( ! this.is_covered_in_z(xyz)) this.set(xyz, "naked-endcap", true)
	    }
	    if (this.left_adjacent(xyz).length == 2) {
		// make an llr triple point
		let llr = this.left_adjacent(xyz).concat([xyz])
		this.set(llr[0], "triple-point", true)
		this.set(llr[0], "triple-point-llr", ["l1"].concat(llr))
		this.set(llr[1], "triple-point", true)
		this.set(llr[1], "triple-point-llr", ["l2"].concat(llr))
		this.set(llr[2], "triple-point", true)
		this.set(llr[2], "triple-point-llr", ["r"].concat(llr))
	    }
	    if (this.right_adjacent(xyz).length == 2) {
		// make an lrr triple point
		let lrr = [xyz].concat(this.right_adjacent(xyz))
		this.set(lrr[0], "triple-point", true)
		this.set(lrr[0], "triple-point-lrr", ["l"].concat(lrr))
		this.set(lrr[1], "triple-point", true)
		this.set(lrr[1], "triple-point-lrr", ["r1"].concat(lrr))
		this.set(lrr[2], "triple-point", true)
		this.set(lrr[2], "triple-point-lrr", ["r2"].concat(lrr))
	    }
	},
	is_triple_point: function(xyz) { return this.get(xyz, "triple-point") },
	triple_point_eval : function(xyz) {
	    if (this.exists(xyz, "triple-point-llr")) {
		let [t, l1, l2, r] = this.get(xyz, "triple-point-llr")
		let cl1 = this.all_empty(this.left_closure(l1))
		let cl2 = this.all_empty(this.left_closure(l2))
		let cr = this.all_empty(this.right_closure(r))
		if (cr) {
		    if (cl1 && this.is_filled(l2)) {
			return t === "l1" || t === "r"
		    } else if (this.is_filled(l1) && cl2) {
			return t === "l2" || t === "r"
		    }
		}
	    }
	    if (this.exists(xyz, "triple-point-lrr")) {
		[t,l,r1,r2] = this.get(xyz, "triple-point-lrr")
		let cl = this.all_empty(this.left_closure(l))
		let cr1 = this.all_empty(this.right_closure(r1))
		let cr2 = this.all_empty(this.right_closure(r2))
		if (cl) {
		    if (cr1 && this.is_filled(r2)) {
			return t === "l" || t === "r1"
		    } else if (this.is_filled(r1) && cr2) {
			return t === "l" || t === "r2"
		    }
		}
	    }
	    return false
	},
	// a relation is a list of slots which are so related
	// sort into z layers, then by x, then by y
	sort_slots : function(rel) {
	    return rel.sort((a,b) => (a[2] != b[2] ? a[2]-b[2] : a[0] != b[0] ? a[0]-b[0] : a[1]-b[1]))
	},
	// join two relations, simply eliminate duplicates
	join_relation : function(r1, r2) {
	    return this.sort_slots(r1.concat(r2.filter(s => r1.indexOf(s) < 0)))
	},
	// find the z-shadow cast by this tile on the next layer
	compute_z_shadow : function(xyz) {
	    let [x,y,z] = xyz
	    let shadow = []
	    if (z > 0) {
		let x0 = x-0.5
		let x1 = x+0.5
		let y0 = y-0.5
		let y1 = y+0.5
		for (slot of this.layer_slots(z-1)) {	
	    let [nx,ny,nz] = slot
		    if ((Math.min(x1,nx+0.5)-Math.max(x0,nx-0.5)) > 0 
			&& (Math.min(y1,ny+0.5)-Math.max(y0,ny-0.5)) > 0) {
			shadow.push(slot)
		    }
		}
	    }
	    this.set(xyz, "z-shadow", shadow)
	},
	compute_x_closure : function(xyz) {
	    if (this.get(xyz, "x-closure").length == 0) {
		let x_closure = this.compute_relation_closure(xyz, "x-adjacent")
		for (slot of x_closure) {
		    this.set(slot, "x-closure", x_closure)
		}
	    }
	},
	compute_relation_closure : function(xyz, relation) {
	    let closure = new Map()
	    let level = 1
	    closure.set(xyz, level)
	    let found = 1
	    while (found != 0) {
		found = 0
		level += 1
		for (slot of closure.keys()) {
		    if (closure.get(slot) != level-1) continue
		    for (s of this.get(slot, relation)) {
			if ( ! closure.has(s)) {
			    found += 1
			    closure.set(s, level)
			}
		    }
		}
	    }
	    // unset closure($xyz)
	    return this.sort_slots(Array.from(closure.keys()))
	},
	// compute the row closure of a slot
	compute_row_closure : function(xyz) {
	    let left_closure = this.compute_relation_closure(xyz, "left-adjacent")
	    let right_closure = this.compute_relation_closure(xyz, "right-adjacent")
	    let row_closure = this.join_relation(left_closure, right_closure)
	    this.set(xyz, "row-closure", row_closure)
	    this.set(xyz, "left-closure", left_closure)
	    this.set(xyz, "right-closure", right_closure)
	},
	// accessors
	z_shadow : function(xyz) { return this.get(xyz, "z-shadow") },
	x_adjacent : function(xyz) { return this.get(xyz, "x-adjacent") },
	x_closure : function(xyz) { return this.get(xyz, "x-closure") },
	left_adjacent : function(xyz) { return this.get(xyz, "left-adjacent") },
	right_adjacent : function(xyz) { return this.get(xyz, "right-adjacent") },
	block : function(xyz) { return this.get(xyz, "block") },
	row : function(xyz) { return this.get(xyz, "row") },
	row_closure : function(xyz) { return this.get(xyz, "row-closure") },
	left_closure : function(xyz) { return this.get(xyz, "left-closure") },
	right_closure : function(xyz) { return this.get(xyz, "right-closure") },
	// number of empty slots, all filled, or all empty
	number_empty : function(slots) { return slots.map(s => (this.is_empty(s) ? 1 : 0)).reduce((a,b) => (a+b), 0) },
	all_filled : function(slots) { return this.number_empty(slots) === 0 },
	all_empty : function(slots) { return this.number_empty(slots) === slots.length },
	any_filled : function(slots) { return this.number_empty(slots) < slots.length },
	// well known slot sets all filled or all empty
	any_filled_x_adjacent : function(xyz) { return this.any_filled(this.x_adjacent(xyz)) },
	all_filled_left_adjacent : function(xyz) { return this.all_filled(this.left_adjacent(xyz)) },
	all_filled_right_adjacent : function(xyz)  { return this.all_filled(this.right_adjacent(xyz)) },
	all_empty_left_adjacent : function(xyz) { return this.all_empty(this.left_adjacent(xyz)) },
	all_empty_right_adjacent : function(xyz) { return this.all_empty(this.right_adjacent(xyz)) },
	// can a slot be played
	can_play : function(slot) {
	    // cannot play an empty slot
	    if (this.is_empty(slot)) { return false }
	    // cannot play if covered in z
	    if (this.is_covered_in_z(slot)) { return false }
	    // cannot play if covered in x
	    if (this.is_covered_in_x(slot)) { return false }
	    return true
	},
	is_covered_in_z : function(slot) {
	    let [x,y,z] = slot
	    for (s of this.layer_slots(z+1)) {
		if (this.is_filled(s) && this.z_shadow(s).indexOf(slot) >= 0) {
		    return true
		}
	    }
	    return false
	},
	is_covered_in_x : function(slot) {
	    if (this.is_endcap(slot)) { return false }
	    // console.log("is_covered_in_x "+slot.join(","))
	    // console.log("left_adjacent "+this.left_adjacent(slot).map((x) => x.join(",")).join(";"))
	    // console.log("right_adjacent "+this.right_adjacent(slot).map((x) => x.join(",")).join(";"))
	    if (this.all_empty_left_adjacent(slot)) { return false }
	    if (this.all_empty_right_adjacent(slot)) { return false }
	    return true
	},
	// can a slot be unplayed
	can_unplay : function(slot, donotblock=false) {
	    // cannot unplay a filled slot
	    if ( ! this.is_empty(slot)) { return false }
	    // cannot unplay a slot over an empty slot in z
	    if (this.covers_empty_in_z(slot)) { return false }
	    // cannot unplay a slot over an empty slot in x
	    if (this.covers_empty_in_x(slot)) { return false }
	    // if donotblock is present, do not play next to or over it
	    if (donotblock) {
		// this was once the last bug in the game generator, if you
		// choose the two slots to unplay independently, then
		// the second can block the first, to be a legal unplay
		// you have to be able to play the slots in either order
		if (this.blocks_in(slot, donotblock)) { return false }
	    }
	    // that was the last bug, but there is another. it is possible to
	    // unplay legal moves to a deadlock. so I need to look ahead to
	    // choose the best unplayable, or somehow finesse the problem
	    return true
	},
	//
	covers_empty_in_z : function(slot) {
	    return this.z_shadow(slot).some((s) => (this.is_empty(s)))
	},
	//
	covers_empty_in_x : function(slot) {
	    // Each x-adjacent-closure shall start in one compartment
	    // there are ways that multiple seeds could start in 
	    // different rows in the compartment and grow together
	    // but the growth cannot cross a boundary between different 
	    // numbers of rows except when the crossing into row(s) is(are)
	    // completely covered by the crossing out of row(s)
	    // console.log("covers_empty_in_x "+slot_string(slot))
	    let x = this.x_closure(slot)
	    let n = x.length
	    let ne = x.map((s) => (this.is_empty(s)?1:0)).reduce((a,b)=>(a+b))
	    // entirely empty, any slot will do
	    if (ne === n) { 
		// console.log("not covers_empty_in_x -> x_closure is empty")
		return false 
	    }
	    // one slot left, it will do
	    if (ne == 1) {
		// console.log("not covers_empty_in_x -> x_closure is filled")
		return false
	    }
	    // if it is an endcap slot
	    if (this.is_endcap(slot)) {
		// all neighbors filled, it will do else wait until they're filled
		if (this.all_filled(this.x_adjacent(slot))) {
		    // console.log("not covers_empty_in_x -> endcap neighbors all filled")
		    return false
		} else {
		    // console.log("does covers_empty_in_x -> endcap neighbors not all filled")
		    return true
		}
	    }
	    // this block is empty, but the closure is not empty
	    if (this.all_empty(this.block(slot))) {
		// if all our neighbors to one side are filled, then okay, else not
		if (this.all_filled_left_adjacent(slot)) {
		    // console.log("not covers_empty_in_x -> block empty left neighbors all filled")
		    return false
		}
		if (this.all_filled_right_adjacent(slot)) {
		    // console.log("not covers_empty_in_x -> block empty right neighbors all filled")
		    return false
		}
		// console.log("does covers_empty_in_x -> block empty neighbors not all filled")
		return true
	    }
	    // this block is not empty
	    // this row, and its extensions into adjoining blocks are all empty
	    // this is the key, isn't it?
	    if (this.all_empty(this.row_closure(slot))) {
		// if we are in a block that contains filled slots
		// but a row that is empty, then any slot in the row
		// is acceptable, but only if the rows connected to this
		// row in the closure are empty, too.
		// console.log("not covers_empty_in_x -> block not empty but row closure empty")
		return false
	    } else {
		// if we are in a row closure that contains filled slots
		// then if we are adjacent to a filled slot, okay,
		// else not okay
		if (this.all_filled_left_adjacent(slot)) {
		    // console.log("not covers_empty_in_x -> block not empty, row closure not empty, but left adjacent filled")
		    return false
		} else if (this.all_filled_right_adjacent(slot)) {
		    // console.log("not covers_empty_in_x -> block not empty, row closure not empty, but right adjacent filled")
		    return false
		} 
		// if there is a junction where two slots are x-adjacent to one slot,
		// and one of the two slots filled,
		// and the outward row closure empty for the other two slots
		// then the other two slots may be unplayed onto
		if (this.is_triple_point(slot) && this.triple_point_eval(slot)) {
		    return false
		}
		return true
	    }
	    alert("failed to classify case")
	},
	// does slot $sl1 block in slot $sl2
	blocks_in : function(sl1, sl2) {
	    // sl1 is on top of sl2 and blocks it in
	    if (this.z_shadow(sl1).indexOf(sl2) >= 0) {
		return true
	    }
	    // sl1 is not next to sl2
	    if (this.x_adjacent(sl1).indexOf(sl2) < 0) {
		return false
	    }
	    // sl2 is free on the other side
	    if (this.is_endcap(sl2)) {
		return false
	    }
	    // sl1 is to the left of sl2
	    if (this.left_adjacent(sl2).indexOf(sl1) >= 0) {
		// and there is nothing to the right
		return ! this.all_empty_right_adjacent(sl2)
	    }
	    // sl1 is to the right of sl2
	    // and there is nothing to the left
	    return ! this.all_empty_left_adjacent(sl2)
	},
	sizes : () => [width, height],
    }
    for (part of map) {
	layout.expand_layout(part)
    }
    for (slot of slots) {
	layout.compute_x_adjacent(slot)
	layout.compute_z_shadow(slot)
    }
    for (slot of slots) {
	layout.compute_x_closure(slot)
	layout.compute_row_closure(slot)
    }
    // console.log("slot [xadj,ladj,radj,clo,lclo,rclo,xclo,endc,nend]")
    for (slot of slots) {
	if (slot_z(slot) != 0) break
	let nxadj = layout.x_adjacent(slot).length
	let nladj = layout.left_adjacent(slot).length
	let nradj = layout.right_adjacent(slot).length
	let nclo = layout.row_closure(slot).length
	let nlclo = layout.left_closure(slot).length
	let nrclo = layout.right_closure(slot).length
	let xclo = layout.x_closure(slot).length
	let endc = layout.is_endcap(slot)
	let nend = layout.is_naked_endcap(slot)
	// console.log(slot_string(slot)+" ["+[nxadj,nladj,nradj,nclo,nlclo,nrclo,xclo,endc,nend].join(", ")+"]")
	// , "x-closure", "row-closure", "left-closure", "right-closure"
	// for (rel of ["x-adjacent", "left-adjacent", "right-adjacent"]) {
	    // console.log("  "+rel+" "+xy_set_string(layout.get(slot, rel)));
	// }
    }
    return layout
}

function MahjongTiles(root) {
    let images = [
	"one-coin", "two-coins", "three-coins", "four-coins", "five-coins", "six-coins", "seven-coins",
	"eight-coins", "nine-coins", "one-bamboo", "two-bamboo", "three-bamboo", "four-bamboo", "five-bamboo",
	"six-bamboo", "seven-bamboo", "eight-bamboo", "nine-bamboo", "one-character", "two-character", 
	"three-character", "four-character", "five-character", "six-character", "seven-character", 
	"eight-character", "nine-character", "north-wind", "west-wind", "south-wind", "east-wind", "season",
	"flower", "white-dragon", "red-dragon", "green-dragon"
    ]
    let tiles = []

    // tile sizes
    let tilew = 64				// tile image width
    let tileh = 88				// tile image height
    let offx = tilew / 10.0			// offset from left edge to tile face
    let offy = tileh / 11.0			// offset from bottom edge to tile face
    let facew = tilew - offx			// tile face width
    let faceh = tileh - offy			// tile face height

    let self = {
	get_tiles : () => tiles,
	match : (name1, name2) => name1.substring(0,name1.length-2) === name2.substring(0,name2.length-2),
	draw : function(slot, name) {
	    let [x,y,z] = slot
	    sx = (x+0.25)*facew + z*offx
	    sy = (y+0.25)*faceh - z*offy
	    var translate = root.$.mahjong.createSVGTransform();
	    translate.setTranslate(sx,sy);
	    root.$[name].transform.baseVal.initialize(translate)
	    for (id of [name, name+"-bg", name+"-fg"]) {
		//root.$[id].x.baseVal.value = sx
		//root.$[id].y.baseVal.value = sy
	    }
	    root.$[name].style.display = ""
	},
	show : function(slot, name, tag) {
	    if (tag == "blank") {
		root.$[name+"-fg"].style.display = ""
		root.$[name+"-bg"].setAttribute("href", "#plain-tile")
	    } else {
		root.$[name+"-fg"].style.display = ""
		root.$[name+"-bg"].setAttribute("href", "#"+tag+"-tile")
	    }
	},
	hide : function(slot, name) {
	    if (name != null) {
		// console.log("hide(slot, "+name+")")
		root.$[name].style.display = "none"
	    }
	},
	sizes : () => [tilew, tileh, offx, offy, facew, faceh],
    }

    function create(id, image) {
	let tile = document.createElementNS("http://www.w3.org/2000/svg", "g")
	let bg = document.createElementNS("http://www.w3.org/2000/svg", "use")
	let fg = document.createElementNS("http://www.w3.org/2000/svg", "use")

	tile.id = id
	bg.id = id+"-bg"
	fg.id = id+"-fg"

	bg.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#"+"plain-tile")
	fg.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#"+image)

	tile.appendChild(bg)
	tile.appendChild(fg)
	root.$.mahjong.appendChild(tile)
	
	root.$[bg.id] = bg
	root.$[fg.id] = fg
	root.$[id] = tile

	return id
    }

    // create the tiles
    for (let t of images) { 
	for (let i of [1,2,3,4]) {
	    tiles.push(create(t+"-"+i, t))
	}
    }

    return self
}

function MahjongGame(root, layout, tiles, prefs, game_seed) {
    // local variables
    let title = "mahjong"
    let shuffled_tiles = null
    let shuffled_slots = null
    let remaining_moves = 0
    let remaining_tiles = 0
    let paused = false
    let hint = -1
    let scores = []
    let history = {}
    let selected = null
    let status_started = false
    let name_to_slot = new Map()

    // local functions
    let random = alea("this is the seed").double
    function srandom(seed) { random = alea(seed).double }

    function shuffle(list) {
	list = list.slice(0)
	let n = list.length
	for (let i = 0; i < n; i += 1) {
	    let j = i + Math.floor(random()*(n-i))
	    if (i != j) {
		let li = list[i]
		let lj = list[j]
		list[i] = lj
		list[j] = li
	    }
	}
	return list
    }
    
    function clock_millis() { return Date.now() }
    function clock_seconds() { return Math.floor(clock_millis() / 1000) }

    function slot_string(slot) { return slot.join(",") }

    let start_game = 0
    let start_time = 0
    let stop_time = 0

    function reset_timer() {
	start_game = clock_seconds()
	start_time = 0
	stop_time = 0
    }
    function start_timer() {
	if (start_time == 0) { start_time = clock_seconds() }
    }
    function stop_timer() {
	if (stop_time == 0) { stop_time = clock_seconds() }
    }
    function pause_timer() {
	if (stop_time == 0) { stop_time = clock_seconds() }
    }
    function continue_timer() {
	if (stop_time != 0) { 
	    start_time = clock_seconds()-(stop_time-start_time)
	    stop_time = 0
	}
    }
    function elapsed_time() {
	if (start_time == 0) return 0
	if (stop_time != 0) return stop_time-start_time
	return clock_seconds-start_time
    }

    function scan_game(seed) {
	let a = 'a'.charCodeAt(0)
	let n = 0
	for (let c of seed.split('').map(x => x.charCodeAt(0))) {
	    n = n * 26 + (c-a)
	}
	return n
    }
    function format_game (game) {
	let format = []
	let a = 'a'.charCodeAt(0)
	while (game >= 1) {
	    format.push(String.fromCharCode(Math.floor(game % 26)+a))
	    game = game / 26
	}
	return format.reverse().join('')
    }

    function slot_distance(slot1, slot2) {
	let [x1,y1,z1] = slot1, [x2,y2,z2] = slot2
	let sqr = (x) => x*x
	return sqr(x1-x2)+sqr(y1-y2)+sqr(z1-z2)
    }
    function move_distance(slot1, slot2, slot3) {
	return slot_distance(slot1, slot2)+slot_distance(slot1, slot3)
    }
    
    let game = {
	// options 
	trace: false,
	infinite: false,
	watch: true,
	raw_deal: true,
	zoomed: true,
	fullscreen: true,

	// delegated to slots
	// set_slot : (slot, name) =>  layout.set_slot(slot, name),
	// set_empty : (slot) => layout.set_empty(slot),
	// layer_slots : (z) => layout.layer_slots(z),
	// is_endcap : (slot) => layout.is_endcap(slot),
	is_naked_endcap : (slot) => layout.is_naked_endcap(slot),
	// z_shadow : (slot) => layout.z_shadow(slot),
	// x_adjacent : (slot) => layout.x_adjacent(slot),
	can_unplay : (slot, donotblock) => layout.can_unplay(slot, donotblock),
	can_play : (slot) => layout.can_play(slot),

	// delegated to tiles
	get_tiles : () => tiles.get_tiles(),
	match : (a,b) => tiles.match(a,b),
	draw : (slot, name) => tiles.draw(slot, name),
	show : (slot, name, tag) => tiles.show(slot, name, tag),
	hide : (slot, name) => tiles.hide(slot, name),

	// recreate mahjong::canvas
	set_name_slot : (name, slot) => name_to_slot.set(name, slot),
	get_name_slot : (name) => name_to_slot.get(name),
	set_slot_name : (slot,name) => layout.set_slot(slot,name),
	get_slot_name : (slot) => layout.get_slot(slot),
	is_empty_slot : (slot) => layout.is_empty(slot),
	get_all_slots : function() { return layout.get_slots() },
	get_remaining_tiles : () => tiles.get_tiles().filter((name) => (name_to_slot.get(name) != null)),
	tile_sizes : () => tiles.sizes(),
	layout_sizes : () => layout.sizes(),
	xy_for_slot : (slot) => tiles.xy_for_slot(slot),

	// don't worry about this, at least not yet
	// context menu, button 3 or 2 on the background
	// with single character accelerators on the root window
	// method menu-build {} {
	// }
	// popup the menu when we are over the background
	// method menu-popup {w x y} {
	// }
	// enable and disable lists of menu entries
	menu_enable_disable : function(enable, disable) {
	    //foreach label $enable { .m entryconfigure $label -state normal }
	    //foreach label $disable { .m entryconfigure $label -state disabled }
	},
	// protect an accelerator from calling the entry function when disabled
	// method menu-protect {label meth} {
	// }


	first_game : function() {
	    if (this.game != null) {
		this.new_game(scan_game(this.game))
	    } else {
		let game = clock_seconds()
		this.new_game(game)
	    }
	    if (this.infinite) {
		while (true) {
		    let game = clock_seconds()
		    this.trace_puts("new-game "+format_game(game))
		    this.new_game(game)
		}
	    }
	},
	new_game : function(game) {
	    this.setup(game)
	    for (let done = false; ! done; ) {
		done = true
		try {
		    this.restart()
		} catch(e) {
		    console.log("restart failed: "+e)
		    console.log("reshuffling and retrying")
		    shuffled_slots = shuffle(shuffled_slots)
		    done = false
		}
	    }
	},
	restart_game : function() { this.restart() },
	pause_game : function() {
	    this.clear-selected()
	    paused = true
	    pause_timer()
	    for (let tile of this.get_remaining_tiles()) { this.show(this.get_name_slot(tile), tile, "blank") }
	    this.menu_enable_disable(["Continue"], ["New Game", "Restart", "Pause", "Hint", "Undo", "Redo", "Scores", "Preferences", "Help"])
	},
	continue_game : function() {
	    this.menu_enable_disable(["New Game", "Restart", "Pause", "Hint", "Undo", "Redo", "Scores", "Preferences"], ["Continue"])
	    for (let tile of this.get_remaining_tiles()) { this.show(this.get_name_slot(tile), tile, "plain") }
	    continue_timer()
	    paused = false
	},
	hint : function() {
	    let slots = this.find_moves()
	    if (slots.length > 0) {
		hint += 1
		let slot = slots[hint % slots.length]
		this.set_selected(slot, this.get_slot_name(slot))
	    }
	},
	undo : function() { this.history_undo() },
	redo : function() { this.history_redo() },
	menu_menu : function() { this.menu_popup() },
	scores : function() { this.scores_window() },
	scores_window : function() {
	    // toplevel .scores
	    // wm title .scores {Scores}
	    //	pack [ttk::button .scores.close -text Close -command [list destroy .scores]] -side top
	},
	preferences : function() {
	    // toplevel .preferences
	    // wm title .preferences {Preferences}
	    // foreach opt {watch raw-deal trace} {
	    // pack [ttk::checkbutton .preferences.$opt -text $opt -variable [myvar options(-$opt)]] -side top -expand true -fill x
	    // }
	    // pack [ttk::button .preferences.close -text Close -command [list destroy .preferences]] -side top
	    // #report-option-classes .preferences
	},
	help : function() { 
	    // toplevel .help
	    // wm title .help {Help}
	    // grid [text .help.text -yscrollcommand [list .help.scrollbar set]] -column 0 -row 0 -sticky nsew
	    // foreach t {
	    // {Mahjong solitaire is played by selecting matching pairs of tiles and removing them from the layout.}
	    // {}
	    // {The layout is constructed so that there is always at least one solution.}
	    // {}
	    // {The controls are available as hot key commands or from a right mouse menu on the game's background.}
	    // } {
	    // .help.text insert end $t\n
	    // }
	    // grid [ttk::scrollbar .help.scrollbar -orient vertical -command [list .help.text yview]] -column 1 -row 0 -sticky ns
	    // grid [ttk::button .help.close -text Close -command [list destroy .help]] -column 0 -row 1 -columnspan 2
	},
	by_name : function() {
	    // toplevel .byname
	    // wm title .byname {By Name}
	    // grid [ttk::label .byname.l -text {Choose game by name}] -row 1 -column 0 -columnspan 2 -sticky ew 
	    // grid [ttk::entry .byname.e] -row 2 -column 0 -columnspan 2 -sticky ew
	    // .byname.e insert end [format-game $options(-game)]
	    // grid [ttk::button .byname.okay -text Okay -command [mymethod by-name-okay]] -row 3 -column 0 -sticky ew
	    // grid [ttk::button .byname.cancel -text Cancel -command [list destroy .byname]] -row 3 -column 1 -sticky ew
	    // #report-option-classes .byname
	},
	by_name_okay : function(how) {
	    // set options(-game) [scan-game [.byname.e get]]
	    // destroy .byname
	    // $self new-game $options(-game)
	},
	draw_frame : function(level) {
	    // $win delete frame
	    // foreach {twid thgt xstep ystep fwid fhgt} [$self tile-sizes] break
	    // foreach slot [$self layer-slots $level] {
	    // foreach {x y} [$self xy-for-slot $slot] break
	    // set x [expr {$x+$xstep}]
	    // $win create rectangle $x $y [expr {$x+$fwid}] [expr {$y+$fhgt}] -fill {} -outline white -tags frame
	    // $win create text [expr {$x+10}] [expr {$y+$ystep+10}] -anchor nw -text $slot -fill white -tags frame
	    // }
	    // $win lower frame
	    // $win move frame {*}$options(-offsets)
	},
	
	quit_game : function() { 
	    // destroy .
	},
	
	destroy_window : function(window) {
	    // if {$window ne $win} return
	    this.score_gamed_save()
	    this.save_prefs()
	},
    
	save_prefs : function() {
	    this.prefs.save_prefs([
		// "zoomed", this.zoomed,
		// "fullscreen", this.fullscreen,
		// "geometry", [wm geometry .]
		// watch $options(-watch)
		// raw-deal $options(-raw-deal)
		// trace $options(-trace)
	    ])
	},
	save_scores : function() {
	    this.prefs.save_scores(scores)
	},
	load_prefs : function() {
	    // #puts "enter load-prefs in mahjong::canvas"
	    // let prefs this.prefs.load_prefs()
	    // #puts "load-prefs prefs are {[array get prefs]}"
	    // foreach v {watch trace raw-deal} {
	    // if {[info exists prefs($v)]} {
	    // set options(-$v) $prefs($v)
	    // }
	    // }
	},
	load_scores : function() {
	    scores = this.prefs.load_scores()
	},
	// ##
	// ## game play helpers
	// ##
	get_items : function() { return this.items },
    
	sort_matching : function(names) {
	    names = names.slice(0)	// avoid overwriting
 	    let sort = []
 	    while (names.length > 0) {
 		let name1 = names.shift()
		if (name1 == null) continue
		sort.push(name1)
		for (let n2 = 0; n2 < names.length; n2 += 1) {
		    let name2 = names[n2]
		    if (name2 == null) continue
		    if (this.match(name1, name2)) {
			sort.push(name2)
			names[n2] = null
 			break
 		    }
 		}
 	    }
	    // $self trace-puts [lmap i $sort {$self item-to-name $i}]
 	    return sort
	},
    
	sort_fertility : function(slots) {
	    let plain = []
	    let endcaps = []
	    for (let slot of slots) {
		if (this.is_naked_endcap(slot)) {
		    endcaps.push(slot)
		} else {
		    plain.push(slot)
		}
	    }
	    return plain.concat(endcaps)
	},

	raise_in_render_order : function() {
	    // presuming that get_all_slots() returns slots in render order
	    for (let slot of this.get_all_slots()) {
		let tile = this.get_slot_name(slot)
		if (tile) {
		    // move it to the end of the render list
		    root.$.mahjong.removeChild(root.$[tile])
		    root.$.mahjong.appendChild(root.$[tile])
		    // $win raise [$self get-slot-name $slot]
		}
	    }
	},
    
	//
	// window title bar status
	//
	start_status : function() {
	    if ( ! status_started) {
		// FIX.ME after 100 ms, call this.update_status
		status_started = true
	    }
	},
    
	update_status : function() {
	    let gname = format_game(this.game)
	    let elapsed = elapsed_time()
	    // let elapsed =[format {%d:%02d} [expr {$elapsed/60}] [expr {$elapsed%60}]]
	    // wm title . "$options(-title) - $gname - $elapsed - $options(-remaining-moves) moves, $options(-remaining-tiles) tiles"
	    // FIX.ME after 100 ms call  this.update_status
	    status_started = true
	},
    
	score_game : function(time, elapsed, game, remaining_moves, remaining_tiles) {
	},
	score_game_save : function() {
	},
	update_score : function() {
	    remaining_moves = this.count_moves()
	    this.score_game(start_game, elapsed_time(), game, remaining_moves, remaining_tiles)
	    if (remaining_moves == 0) {
		stop_timer()
		if (remaining_tiles > 0) {
		    // game lost
		    // open {restart} {new game} {undo} {quit} dialog 
		    alert("game lost")
		} else {
		    // game won	
	    // open scores positioned at new score
		    alert("game won")
		}
	    }
	},
	count_moves : function() {
	    return this.find_moves().length
	},
    
	//
	// history maintenance
	//
	history_empty : function() {
	    history = {count: 0, future: 0, items: []}
	    this.menu_enable_disable([], ["Undo", "Redo"])
	},
	history_save_reversed : function() {
	    let h = history
	    return { count:0, future: h.future, items: h.items.reverse() }
	},
	history_restore : function(h) {
	    this.clear_selected()
	    history = h
	    if (h.count < h.future) {
		this.menu_enable_disable(["Undo", "Redo"], [])
	    } else {
		this.menu_enable_disable(["Undo"],["Redo"])
	    }
	},
	history_get_count : function() { return history.count },
	history_get_future : function() { return history.future },
	history_get_items : function() { return history.items },
	history_add : function(name1, slot1, name2, slot2) {
	    let h = history
	    this.clear_selected()
	    if (h.items.length > h.count) {
		h.items = h.items.slice(0, h.count-1)
	    }
	    h.items.push([name1, slot1, name2, slot2])
	    h.count += 1
	    h.future = h.count
	    this.menu_enable_disable(["Undo"],["Redo"])
	},
	history_undo : function() {
	    // step back
	    let h = history
	    this.clear_selected()
	    h.count -= 1
	    this.move_place.apply(this, h.items[h.count])
	    if (h.count > 0) {
		this.menu_enable_disable(["Undo", "Redo"], [])
	    } else {
		this.menu_enable_disable(["Redo"],["Undo"])
	    }
	    this.update_score()
	},
	history_redo : function() {
	    // step forward
	    let h = history
	    this.clear_selected()
	    this.move_unplace.apply(this, h.items[h.count])
	    h.count += 1
	    if (h.count < h.future) {
		this.menu_enable_disable(["Undo", "Redo"], [])
	    } else {
		this.menu_enable_disable(["Undo"],["Redo"])
	    }
	    this.update_score()
	},

	//
	// setup the next game
	// 
	setup : function(game) {
	    // set up for a new game which might be restarted
	    // so, game number seeds random number generator, 
	    // results in shuffle of -slots and -tiles
	    // the optional $game may be supplying a game by name
	    // or simply the time
	    if (typeof game === "undefined") { game = clock_seconds() }
	    game_seed = game
	    srandom(game_seed)
	    // console.log(this.get_all_slots())
	    shuffled_slots = shuffle(this.get_all_slots())
	    shuffled_tiles = shuffle(this.get_tiles())
	    // console.log("shuffled_slots"); console.log(shuffled_slots)
	    // console.log("shuffled_tiles"); console.log(shuffled_tiles)
	    this.start_status()
	},
    
	//
	// start or restart the currently setup game
	//
	restart : function() {
	    // save the result of the last game
	    this.score_game_save()
	    // reset timer
	    reset_timer()
	    // clear selection
	    this.clear_selected()
	    // reset slot to name map
	    for (let slot of this.get_all_slots()) { 
		let name = this.get_slot_name(slot)
		if (this.tile_is_placed(slot, name)) {
		    this.tile_unplace(slot, name)
		    // if (this.watch) this.update
		}
		this.set_slot_name(slot, null)
	    }
	    // reset name to slot map
	    for (let name of this.get_tiles()) { this.set_name_slot(name, null) }

	    // one update if we are not watch to clear the board
	    // if ( ! this.watch) this.update

	
	    // pick matching pairs from available
	    let names = shuffled_tiles.slice(0)
	    let slots = shuffled_slots.slice(0)
	    let moves = []
	    remaining_tiles = 0
	
	    if (false) {
		for (let i = 0; i < names.length; i += 1) this.tile_place(slots[i], names[i])
		this.history_empty()
		remaining_moves = this.count_moves()
		this.raise_in_render_order()
	    } else {
		// make an initial update
		// if (this.watch) this.update
		names = this.sort_matching(names)
		while (names.length > 0) {
		    if (remaining_tiles != 144-names.length) {
			throw("remaining-tiles "+remaining_tiles+" != 144-names.length 144-"+names.length)
		    }
		    if (remaining_tiles != this.get_remaining_tiles().length) {
			throw("remaining-tiles "+remaining_tiles+" !=  get-remaining-tiles().length "+this.get_remaining_tiles().length)
		    }

		    // choose the pair of matched tiles to play
		    // take first and second tiles in name list
		    let name1 = names.shift()
		    let name2 = names.shift()
		    // console.log("name1 "+name1+", name2 "+name2)
		    // take first open slot in slot list
		    let slot1 = this.find_can_unplay(slots)
		    if (slot1 == null) {
			this.trace_puts("slot1 is null")
			break
		    }

		    let s1 = slots.indexOf(slot1)
		    slots.splice(s1,1)

		    // put the first tile in its slot
		    this.tile_place(slot1, name1)
		    moves.push(name1, slot1)
		    
		    // if (this.watch) this.update

		    // take next open slot in slot list
		    // but avoid slots that block $slot1
		    let slot2 = this.find_can_unplay(slots, slot1)
		    
		    while (slot2 == null) {
			// there is no unplayable slot2 that doesn't block slot1
			// undo the unplay farthest from slot1, return the unplayed
			// slots and names to the todo lists, and retry slot2 search
			let bestm = null
			let bestd = -1
			for (let m of this.find_moves()) {
			    // okay, so the pairs of matching tiles found by search
			    // may not have been unplayed as a pair, which will
			    // make it hard to remove them from the $moves list
			    // so reject pairs that aren't moves in $moves
			    if ( ! this.is_an_unplayed_move(m[0], m[1], moves)) {
				this.trace_puts("! is-an-unplayed-move "+m)
				continue
			    }
			    let d = move_distance(slot1,m[0],m[1])
			    if (d > bestd) {
				bestm = m
				bestd = d
			    }
			    this.trace_puts("move-distance "+m+" is "+d)
			}
			this.trace_puts("bestm is "+bestm+" at distance "+bestd)
			// since we are only attempting to undo previously completed moves
			// we won't try to undo slot1 because it's only half a move
			// but we might still be digging a hole and filling it back in
			// if we are too close
			if (bestm != null && bestd > 7.0) {
			    // undo $bestm
			    this.trace_puts("undoing {"+bestm+"} at "+bestd)
			    let result = this.undo_unplayed_move(bestm[0],bestm[1],moves,slots,names)
			    // console.log("undo_unplayed_move result.length="+result.length)
			    moves = result[0]
			    slots = result[1]
			    names = result[2]
			    // redo the search for slot2
			    slot2 =  this.find_can_unplay(slots,slot1)
			    continue
			}
			this.trace_puts("slot2 eq null backing out "+slot1)
			// undo move
			// $self trace-puts "undo move"
			moves = moves.slice(0, moves.length-2)
			// $self trace-puts "tile-unplace $slot1 $name1"
			this.tile_unplace(slot1, name1)
			// undo damage
			if (s1 < slots.length) {
			    slots.splice(s1,1)
			} else {
			    slots.push(slot1)
			}
			names = [name1,name2].concat(names) 
			// $self trace-puts "breaking loop"
			// this used to break out of the search loop
			// now it only breaks the slot2 re-search loop
			break
		    }

		    // break the search loop if slot2 failed
		    if (slot2 == null) break
		    
		    let s2 = slots.indexOf(slot2)
		    slots.splice(s2,1)
		    
		    // put the second tile in its slot
		    this.tile_place(slot2, name2)
		    
		    // make backwards history
		    moves.push(name2, slot2)
		    
		    // if (this.watch) this.update
		    
		    // test for forward playability
		    if ( ! this.can_play(slot1)) {
			this.trace_puts("proposed move slot1 "+slot1.join(",")+" cannot play "+name1)
			break
		    } else if ( ! this.can_play(slot2)) {
			this.trace_puts("proposed move slot2 "+slot2.join(",")+" cannot play "+name2)
			break
		    } else if ( ! this.match(name1, name2)) {
			this.trace_puts("proposed move mismatches "+name1+" and "+name2)
			break
		    }
		}
		// this counts the undealt tiles in a deal that fails
		if (names.length > 0) {
		    this.trace_puts( "broke deal loop with "+names.length+" tiles remaining")
		    throw("failed to generate deal")
		    return
		}
		// make and save the history of the play
		// this allows the construction of the deal to be played in reverse
		// at the start of each game by redoing moves
		this.history_empty()
		while (moves.length >= 4) {
		    let [name1, slot1, name2, slot2] = moves.splice(0,4)
		    this.history_add(name1, slot1, name2, slot2)
		}
		this.history_restore(this.history_save_reversed())
		
		// raise slots in render order
		this.raise_in_render_order()
		
		// adjust window
		// $self adjust-window $win
		
		// compute
		if (remaining_tiles != this.get_remaining_tiles().length) {
		    console.log("remaining-tiles "+remaining_tiles+" !=  llength get-remaining-tiles "+this.get_remaining_tiles().length)
		}
		remaining_moves = this.count_moves()
	    }
	},

    
	//
	// unplay to avoid deadlock
	//
	is_an_unplayed_move : function(slot1, slot2, moves) {
	    let i1 = moves.indexOf(slot1)
	    let i2 = moves.indexOf(slot2)
	    if (i1 < 0 || i2 < 0) { 
		// console.log("is_an_unplayed_move "+slot_string(slot1)+"@"+i1+" "+slot_string(slot2)+"@"+i2)
		return false
		// throw("play slots are not in history")
	    }
	    if (Math.abs(i1-i2) == 2) {
		if (i1 < i2 && (i1%4) == 1) { return true }
		if (i2 < i1 && (i2%4) == 1) { return true }
	    }
	    return false
	},
	undo_unplayed_move : function(slot1, slot2, moves, slots, names) {
	    // console.log("undo_unplayed_move slot1 "+slot_string(slot1)+" slot2 "+slot_string(slot2))
	    // console.log(slot1)
	    // console.log(slot2)
	    // console.log(moves)
	    // console.log(slots)
	    // console.log(names)
	    // get the slot indexes
	    let i1 = moves.indexOf(slot1)
	    let i2 = moves.indexOf(slot2)
	    // swap the slots so $i1 < $i2
	    if (i2 < i1) {
		[slot1, slot2, i1, i2] = [slot2, slot1, i2, i1]
	    }
	    // get the tiles played in the slots
	    let name1 = this.get_slot_name(slot1)
	    let name2 = this.get_slot_name(slot2)
	    // get the indexes where the move is played
	    let j1 = moves.indexOf(name1)
	    let j2 = moves.indexOf(name2)
	    // test our understanding
	    if (i1 != j1+1 || j2 != i1+1 || i2 != j2+1 || (j1%4) != 0) {
		throw("misunderstood the structure of moves")
	    }
	    // remove the slots and names from play
	    this.tile_unplace(slot1,name1)
	    this.tile_unplace(slot2,name2)
	    //#$self set-slot-name $slot1 {}
	    //#$self set-slot-name $slot2 {}
	    //#$self set-name-slot $name1 {}
	    //#$self set-name-slot $name2 {}
	    // remove the move from $moves
	    moves = moves.splice(j1,4)
	    // return the slots to $slots
	    slots.push(slot1, slot2)
	    // return the tiles to $names
	    names.push(name1, name2)
	    return [moves,slots,names]
	},

	//
	// game play/unplay mechanics
	//
	find_slots_in_play : function() {
	    let slots = []
	    for (let s of this.get_all_slots()) if ( ! this.is_empty_slot(s)) slots.push(s)
	    return slots
	},
	find_moves : function() {
	    let moves = []
	    let slots = this.find_all_can_play(this.find_slots_in_play())
	    for (let i = 0; i < slots.length; i += 1) {
		let si = slots[i]
		let ni = this.get_slot_name(si)
		for (let j = i+1; j < slots.length; j += 1) {
		    let sj = slots[j]
		    let nj = this.get_slot_name(sj)
		    if (this.match(ni, nj)) moves.push([si,sj])
		}
	    }
	    return moves
	},
	trace_puts : function(str) { if (this.trace) console.log(str) },
	find_can_unplay : function(slots, donotblock) {
	    for(let slot of slots) if (this.can_unplay(slot, donotblock)) return slot
	    // $self trace-puts "cannot unplay donotblock={$donotblock}: all={[$self find-all-can-unplay $slots]} [$self stats-for-slots $slots]"
	    // $self trace-puts "  slots={$slots}"
	    // $self trace-puts "  moves={[uplevel {set moves}]}"
	    return null
	    throw("cannot unplay")
	},
	find_all_can_unplay : function(slots, donotblock) {
	    let all = []
	    for (let slot of slots) if (this.can_unplay(slot, donotblock)) all.push(slot)
	    return all
	},
	find_can_play : function(slots) {
	    for (let slot of slots) if (this.can_play(slot)) return slot
	    throw("cannot play")
	},
	find_all_can_play : function(slots) {
	    let all = []
	    for (let slot of slots) if (this.can_play(slot)) all.push(slot)
	    return all
	},
	//
	//
	//
	move_place : function(name1, slot1, name2, slot2) {
	    this.tile_place(slot1, name1)
	    this.tile_place(slot2, name2)
	},
	move_unplace : function(name1, slot1, name2, slot2) {
	    this.tile_unplace(slot1, name1)
	    this.tile_unplace(slot2, name2)
	},
	tile_place : function(slot, name) {
	    this.set_slot_name(slot, name)
	    this.set_name_slot(name, slot)
	    this.draw(slot, name)
	    this.show(slot, name, "plain")
	    // root.$[name].onclick = function() { game.onclick(slot, name) }
	    root.$[name+"-bg"].onclick = function() { game.onclick(slot, name) }
	    root.$[name+"-fg"].onclick = function() { game.onclick(slot, name) }
	    // this.raise_in_render_order()
	    remaining_tiles += 1
	},
	tile_unplace : function(slot, name) {
	    this.set_slot_name(slot, null)
	    this.set_name_slot(name, null)
	    this.hide(slot, name)
	    remaining_tiles -= 1
	},
	tile_is_placed : function(slot, name) {
	    return name != null && this.get_slot_name(slot) == name
	},

	// play mechanics
	get_selected : function() { return selected },
	is_selected : function() { return this.get_selected() != null },
	clear_selected : function() {
	    if (this.is_selected()) { 
		let [slot, name] = this.get_selected()
		this.show(slot, name, "plain")
	    }
	    selected = null
	},
	set_selected : function(slot, name) {
	    this.clear_selected()
	    this.show(slot, name, "selected")
	    selected = [slot, name]
	},

	onclick : function(slot1, name1) {
	    // console.log("onclick tile "+name1+" slot "+layout.string(slot))
	    // if paused return
	    if (paused) return
	    // if this slot is playable
	    if (this.can_play(slot1)) {
		// if a slot is already selected
		if (this.is_selected()) {
		    // get the selected slot, clear the selection
		    let [slot2,name2] = this.get_selected()
		    this.clear_selected()
		    if (slot1 == slot2) {
			// if it is the same slot, just return
			// we've cancelled selection and cleared the image
		    } else if (this.match(name1, name2)) {
			// it is a match to the previously selected tile
			// start counting time if not already started
			start_timer()
			// remove the tiles from play
			this.move_unplace(name1, slot1, name2, slot2)
			// keep history
			this.history_add(name1, slot1, name2, slot2)
			// keep score
			this.update_score()
		    } else {
			// select the new tile
			this.set_selected(slot1,name1)
		    }
		} else {
		    this.set_selected(slot1,name1)
		}
		// this is from the original tcl/tk
		// but not how we get the right order now
		// this.raise_in_render_order()
	    }
	},
    }

    // start first game
    game.first_game()
    return game
}

Polymer({
    is: 'mahjong-play',
    ready: function() {
	// tile layout
	let layout = MahjongLayout(this, [
	    // layer z == 0
	    {type: "tile", z: 0, x: 10, y: 3 },
	    
	    {type: "block", z: 0, left: 8.5, right: 9.5, top: 0.5, bottom: 1.5},
	    {type: "block", z: 0, left: 8.0, right: 9.0, top: 2.5, bottom: 3.5},
	    {type: "block", z: 0, left: 8.5, right: 9.5, top: 4.5, bottom: 5.5},
	    
	    {type: "row", z: 0, y: 0, left: 3, right: 7},
	    {type: "row", z: 0, y: 1, left: 2.5, right: 7.5},
	    {type: "block", z: 0, left: 3.0, right: 7.0, top: 2.0, bottom: 4.0},
	    {type: "row", z: 0, y: 5, left: 2.5, right: 7.5},
	    {type: "row", z: 0, y: 6, left: 3, right: 7},
	    
	    {type: "block", z: 0, left: 0.5, right: 1.5, top: 0.5, bottom: 1.5},
	    {type: "block", z: 0, left: 1.0, right: 2.0, top: 2.5, bottom: 3.5},
	    {type: "block", z: 0, left: 0.5, right: 1.5, top: 4.5, bottom: 5.5},
	    
	    {type: "tile", z: 0, y: 3, x: 0},

	    // layer z == 1
	    {type: "tile", z: 1, x: 6.5, y: 0},
	    
	    {type: "row", z: 1, left: 7, right: 9, y: 1},
	    {type: "block", z: 1, left: 7.5, top: 2, right: 8.5, bottom: 4},
	    {type: "row", z: 1, left: 7, right: 9, y: 5},
	    
	    {type: "tile", z: 1, x: 6.5, y: 6},
	    
	    {type: "row", z: 1, y: 0.5, left: 4.5, right: 5.5},
	    {type: "row", z: 1, y: 1.5, left: 4, right: 6},
	    {type: "block", z: 1, top: 2.5, left: 3.5, bottom: 3.5, right: 6.5},
	    {type: "row", z: 1, y: 4.5, left: 4, right: 6},
	    {type: "row", z: 1, y: 5.5, left: 4.5, right: 5.5},
	    
	    {type: "tile", z: 1, x: 3.5, y: 0},
	    
	    {type: "row", z: 1, left: 1, right: 3, y: 1},
	    {type: "block", z: 1, left: 1.5, top: 2, right: 2.5, bottom: 4},
	    {type: "row", z: 1, left: 1, right: 3, y: 5},
	    
	    {type: "tile", z: 1, y: 6, x: 3.5},

	    // layer z == 2
	    {type: "row", z: 2, y: 2, left: 2.5, right: 7.5},
	    {type: "row", z: 2, y: 3, left: 2, right: 8},
	    {type: "row", z: 2, y: 4, left: 2.5, right: 7.5},

	    // layer z == 3
	    {type: "tile", z: 3, x: 7.5, y: 3},
	    {type: "block", z: 3, left: 3.5, right: 6.5, top: 2.5, bottom: 3.5},
	    {type: "tile", z: 3, x: 2.5, y: 3},

	    // layers z == 4, 5, and 6
	    {type: "row", z: 4, y: 3, left: 4, right: 6},
	    {type: "row", z: 5, y: 3, left: 4.5, right: 5.5},
	    {type: "tile", z: 6, y: 3, x: 5},
	]);

	// tile images
	let tiles = MahjongTiles(this)

	// preferences
	let prefs = MahjongPrefs(this)

	// seed, should be web parameter
	let game_seed = null
	
	// viewbox
	let [tilew, tileh, offx, offy, facew, faceh] = tiles.sizes();
	let [layw, layh] = layout.sizes()
	let w = Math.floor((layw+0.5)*facew+offx)
	let h = Math.floor((layh+0.5)*faceh+offy)
	let vb = "0 0 "+w+" "+h
	this.$.mahjong.setAttribute("viewBox", vb)

	// game
	this.game = MahjongGame(this, layout, tiles, prefs, game_seed)

	console.log("finished in mahjong-play.ready");
    },
});
