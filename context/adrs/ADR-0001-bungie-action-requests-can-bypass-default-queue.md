# ADR-0001: Bungie Action Requests Can Bypass Default Queue

Normal Bungie requests stay queued by default, but user-requested mutation work such as transfer planner steps may use an explicit non-queued action channel. This lets independent transfer branches run concurrently without changing default background/data-fetch behavior.
