(factory => {
	if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports)
        if (v !== undefined) module.exports = v
    }
    else if (typeof define === "function" && define.amd)
        define(["require", "exports"], factory)
})((require, exports) => {
    "use strict"
    Object.defineProperty(exports, "__esModule", { value: true })
	exports.default = {
		"body": [
			"before-after",
			"relative",
			"flex",
			"flex-column",
			"body",
			"gap-4",
			"justify-content-centre",
			"align-items-centre",
			"margin-0",
			"padding-block-5",
			"border-box",
			"fixed__before-after",
			"z-index-bg__before-after",
			"block__before-after",
			"top-0__before-after",
			"left-0__before-after",
			"body__before-after",
			"body__before",
			"backdrop-blur-3__after",
			"body__after",
		],
		"card": [
			"block",
			"relative",
			"z-index-fg",
			"padding-inline-4",
			"width-8",
			"before",
			"absolute__before",
			"inset-0__before",
			"z-index-bg__before",
			"backdrop-blur__before",
			"card__before",
		],
		"card-header": [
			"block",
			"width-100",
			"unmargin-inline-4",
			"padding-inline-4",
			"card-header",
			"border-bottom-2",
			"uppercase",
			"padding-block-1",
			"card-header_3",
			"weight-semibold",
			"font-3",
			"colour-6",
		],
		"card-header-text": [
			"font-vertical-align",
		],
		"paragraph": [
			"block",
			"font-vertical-align",
			"margin-block-3",
			"font-2",
		],
		"loading": [
			"flex",
			"flex-column",
			"gap-3",
			"align-items-centre",
			"margin-top-3",
		],
		"loading--loaded": [
			"contents",
		],
		"loading-spinner": [
			"block",
			"width-fit",
			"relative",
			"size-4",
			"margin-3",
			"loading-spinner",
		],
		"loading-spinner-dot": [
			"absolute",
			"size-1",
			"border-radius-100",
			"background-currentcolour",
		],
		"loading-spinner-dot--no-animate": [
			"loading-spinner-dot--no-animate",
		],
		"loading-spinner-dot-1": [
			"translate-up-50",
			"translate-left-50",
			"top-0",
			"left-0",
			"loading-spinner-dot-1",
		],
		"loading-spinner-dot-2": [
			"translate-up-50",
			"translate-right-50",
			"top-0",
			"right-0",
			"loading-spinner-dot-2",
		],
		"loading-spinner-dot-3": [
			"translate-down-50",
			"translate-right-50__2",
			"bottom-0",
			"right-0",
			"loading-spinner-dot-3",
		],
		"loading-spinner-dot-4": [
			"translate-down-50",
			"translate-left-50__2",
			"bottom-0",
			"left-0",
			"loading-spinner-dot-4",
		],
		"loading-progress": [
		],
		"loading-progress--unknown": [
			"hidden",
		],
		"loading-message": [
			"margin-top-0",
		],
		"loading-error-icon": [
		],
		"loading-error": [
		],
		"checkbox": [
			"grid",
			"checkbox",
			"gap-3",
			"padding-1-3",
			"unmargin-inline-3",
			"margin-block-1",
			"align-items-centre",
			"cursor-pointer",
		],
		"checkbox-input": [
			"absolute",
			"appearance-none",
			"no-pointer-events",
		],
		"checkbox-icon": [
			"relative",
			"block",
			"size-3",
			"border-1",
		],
		"checkbox-icon--checked": [
		],
		"checkbox-icon-check": [
			"block",
			"absolute",
			"checkbox-icon-check",
			"transparent",
			"transition-blur",
			"checkbox-icon-check_3",
			"transition-focus",
		],
		"checkbox-icon-check--checked": [
			"checkbox-icon-check--checked",
			"opaque",
		],
		"checkbox-icon-check--active": [
			"checkbox-icon-check--active",
			"transparent__2",
		],
		"checkbox-icon-active-border": [
			"absolute",
			"checkbox-icon-active-border",
			"transition-blur",
			"checkbox-icon-active-border_3",
		],
		"checkbox-icon-active-border--focus": [
			"checkbox-icon-active-border--focus",
		],
		"checkbox-icon-active-border--active": [
			"checkbox-icon-active-border--active",
		],
		"checkbox-icon-active-border--checked": [
			"checkbox-icon-active-border--checked",
		],
		"checkbox-label": [
		],
		"checklist": [
			"grid",
			"checklist",
			"gap-2",
			"padding-0",
			"margin-0",
			"margin-block-3",
		],
		"checklist-item": [
			"grid",
			"column-1-3",
			"columns-subgrid",
			"gap-2",
			"align-items-centre",
		],
		"checklist-item-marker": [
			"colour-7",
			"weight-semibold",
			"font-6",
			"font-vertical-align",
		],
		"checklist-item-content": [
		],
		"checklist-item-check-icon": [
			"opacity-10",
			"before",
			"block__before",
			"checklist-item-check-icon__before",
			"unmargin-top-3__before",
			"margin-right-3__before",
			"checklist-item-check-icon__before_3",
		],
		"checklist-item-check-icon--checked": [
			"opaque",
		],
		"button": [
			"before-after",
			"relative",
			"button",
			"border-1",
			"padding-2-3",
			"font-inherit",
			"font-family-inherit",
			"font-vertical-align",
			"cursor-pointer",
			"button_3",
			"colour-0",
			"decoration-none",
			"block__before-after",
			"absolute__before-after",
			"no-pointer-events__before-after",
			"button__before",
			"transparent__before",
			"button__before_3",
			"transition-blur__before",
			"button__before_5",
			"inset-0__after",
			"transition-blur__after",
			"button__after",
		],
		"button--hover": [
			"before-after",
			"button--hover__before",
			"opaque__before",
			"transition-focus__before",
			"button--hover__after",
			"transition-focus__after",
		],
		"button-text": [
			"font-vertical-align",
		],
		"button--disabled": [
			"cursor-default",
			"border-colour-5",
			"colour-7__2",
			"background-none",
			"before",
			"transparent__before",
			"button--disabled__before",
		],
		"lore": [
			"lore",
		],
		"footer": [
			"flex",
			"justify-content-centre",
			"margin-bottom-3",
		],
		"action-row": [
			"flex",
			"justify-content-end",
			"margin-bottom-3",
			"gap-3",
		],
		"form-row": [
			"flex",
			"flex-column",
		],
		"form-row-label": [
			"font-0",
			"uppercase",
			"weight-semibold",
			"form-row-label",
		],
		"text-input": [
			"appearance-none",
			"border-1",
			"border-radius-0",
			"border-colour-5",
			"padding-1-2",
			"font-3",
			"margin-bottom-3",
			"text-input",
		],
		"details": [
		],
		"details-summary": [
			"margin-bottom-3",
		],
		"details-content": [
		],
		"break": [
			"block",
			"height-1",
		],
		"code": [
			"code",
			"border-radius-1",
			"padding-inline-1",
			"code_3",
		],
		"wordmark-logo": [
			"grid",
			"wordmark-logo",
			"align-items-centre",
			"wordmark-logo_3",
			"width-fit",
			"colour-inherit",
			"decoration-none",
		],
		"wordmark-logo-icon": [
			"wordmark-logo-icon",
		],
		"wordmark-logo-wordmark": [
			"wordmark-logo-wordmark",
		],
		"wordmark-logo-text": [
			"relative",
			"wordmark-logo-text",
			"uppercase",
			"wordmark-logo-text_3",
			"after",
			"block__after",
			"absolute__after",
			"bottom-0__after",
			"wordmark-logo-text__after",
		],
		"main-cards": [
			"contents",
		],
		"grant": [
			"flex",
			"flex-column",
			"colour-inherit",
			"decoration-none",
			"decoration-underline__hover_focus-visible-has-focus-visible",
		],
		"grant-name": [
			"font-3",
		],
		"grant-time": [
			"margin-top-0",
		],
	};
})

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsImZpbGUiOiIvaG9tZS9ydW5uZXIvd29yay9jb25kdWl0LmRlZXBzaWdodC5nZy9jb25kdWl0LmRlZXBzaWdodC5nZy9vdXQvc2VydmljZS9zdHlsZS9pbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbXX0=