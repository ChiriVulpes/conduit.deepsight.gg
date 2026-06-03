import { Task } from 'task'
import lint from './lint'
import typecheck from './typecheck'

export default Task('validate', task => task.series(
	lint,
	typecheck,
))
