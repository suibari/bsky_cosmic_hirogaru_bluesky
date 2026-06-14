export class Starfield {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private resizeObserver: ResizeObserver

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas
		this.ctx = canvas.getContext('2d')!
		this.resizeObserver = new ResizeObserver(() => this.resize())
		this.resizeObserver.observe(canvas.parentElement ?? canvas)
	}

	start(): void {
		this.resize()
		this.draw()
	}

	stop(): void {
		this.resizeObserver.disconnect()
	}

	resize(): void {
		const parent = this.canvas.parentElement
		if (parent) {
			this.canvas.width = parent.clientWidth
			this.canvas.height = parent.clientHeight
		}
		this.draw()
	}

	private draw(): void {
		const { canvas, ctx } = this
		ctx.fillStyle = '#000'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		for (let i = 0; i < 300; i++) {
			const x = Math.random() * canvas.width
			const y = Math.random() * canvas.height
			const r = Math.random() * 1.2 + 0.2
			const opacity = Math.random() * 0.7 + 0.3
			ctx.beginPath()
			ctx.arc(x, y, r, 0, Math.PI * 2)
			ctx.fillStyle = `rgba(255,255,255,${opacity})`
			ctx.fill()
		}
	}
}
