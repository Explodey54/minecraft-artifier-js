function Counter(node) {
	let initFlag = false
	let $root
	let current = 1
	let max = 1
	let callback = null
	const template = `
		<i class="fas fa-2x fa-angle-double-left"></i><i class="fas fa-2x fa-angle-left"></i>
        <input class="input"><span class="counter-span"></span>
        <i class="fas fa-2x fa-angle-right"></i><i class="fas fa-2x fa-angle-double-right"></i>
	`
	const nodes = {
		doubleLeft: null,
		left: null,
		input: null,
		span: null,
		right: null,
		doubleRight: null
	}

	this._setSpan = () => {
		nodes.span.innerHTML = `out of ${max}`
	}

	this._setEventListeners = () => {
		nodes.doubleLeft.onclick = () => {
			this.setValue(1)
		}

		nodes.left.onclick = () => {
			this.setValue(current - 1)
		}

		nodes.input.onchange = () => {
			this.setValue(nodes.input.value)
		}

		nodes.right.onclick = () => {
			this.setValue(current + 1)
		}

		nodes.doubleRight.onclick = () => {
			this.setValue(max)
		}
	}

	this.setValue = (int) => {
		current = int
		if (int < 1) { current = 1 }
		if (int > max) { current = max }
		nodes.input.value = current
		if (callback) {
			callback(current)
		}
	}

	this.setMax = (int) => {
		max = int
		if (current > max) {
			this.setValue(int)
		}
		this._setSpan()
	}

	this.setCallback = (func) => {
		callback = func
	}

	this.init = (node) => {
		if (initFlag === true) { return }
		initFlag = true
		$root = node
		$root.innerHTML = template
		nodes.doubleLeft = $root.querySelector('i.fa-angle-double-left')
		nodes.left = $root.querySelector('i.fa-angle-left')
		nodes.input = $root.querySelector('input.input')
		nodes.span = $root.querySelector('span.counter-span')
		nodes.right = $root.querySelector('i.fa-angle-right')
		nodes.doubleRight = $root.querySelector('i.fa-angle-double-right')
		this._setEventListeners()
	}

	if (node) {
		this.init(node)
	}
}

export default Counter
