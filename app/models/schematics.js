import Zlib from 'zlibjs/bin/zlib_and_gzip.min.js'
import Nbt from 'nbt'

function SchematicsHelper() {
	this.Zlib = Zlib.Zlib

	this.encode = (obj) => {
		const writer = new Nbt.Writer()
		writer.compound(obj)
		const compound = new Uint8Array(writer.getData())
		const compoundName = 'Schematic'
		const output = new Uint8Array(3 + compoundName.length + compound.byteLength)
		output[0] = 10
		output[2] = compoundName.length
		compoundName.split('').forEach((i, k) => {
			output[k + 3] = i.charCodeAt(0)
		})
		output.set(compound, 3 + compoundName.length)
		var gzip = new this.Zlib.Gzip(output)
		var compressed = gzip.compress()
		return compressed
	}

	this.decode = (arr, callback) => {
		const gzip = new this.Zlib.Gunzip(arr)
		Nbt.parse(arr, callback)
	}
}

export default SchematicsHelper