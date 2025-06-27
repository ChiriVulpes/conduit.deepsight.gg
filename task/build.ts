import { Task } from 'task'
import _static from './static'
import ts from './ts'
import vendor from './vendor'

export default Task('build', task => task.series(
	vendor,
	ts,
	_static,
))
