import { Task } from 'task'
import ts from './ts'
import vendor from './vendor'

export default Task('build', task => task.series(
	vendor,
	ts,
))
