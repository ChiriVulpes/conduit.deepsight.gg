export default process.env as Partial<{
	ENVIRONMENT: 'dev' | 'prod'
	PORT: string
	TEST_PORT: string
}>
