namespace Frame {

	export interface Functions {
		update (): Promise<void>
		needsAuth (): Promise<boolean>
	}
}

export default Frame
