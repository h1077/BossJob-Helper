"""Tests for hooks module — SyncHook and BailHook."""
from boss_agent_cli.hooks import SyncHook, BailHook, create_hook_bus


class TestSyncHook:
	def test_call_fires_handlers_in_order(self):
		results = []
		hook = SyncHook()
		hook.tap("a", lambda p: results.append(("a", p["x"])))
		hook.tap("b", lambda p: results.append(("b", p["x"])))
		hook.call({"x": 1})
		assert results == [("a", 1), ("b", 1)]

	def test_exception_swallowed(self):
		"""SyncHook handler exceptions are swallowed."""
		results = []
		hook = SyncHook()
		hook.tap("bad", lambda p: 1 / 0)
		hook.tap("good", lambda p: results.append("ok"))
		hook.call({})
		assert results == ["ok"]

	def test_empty_call(self):
		hook = SyncHook()
		hook.call({})  # should not raise


class TestBailHook:
	def test_no_veto(self):
		hook = BailHook()
		hook.tap("a", lambda p: None)
		assert hook.call({}) is None

	def test_veto_string(self):
		hook = BailHook()
		hook.tap("blocker", lambda p: "blocked by policy")
		assert hook.call({}) == "blocked by policy"

	def test_veto_stops_chain(self):
		results = []
		hook = BailHook()
		hook.tap("blocker", lambda p: "stop")
		hook.tap("never", lambda p: results.append("reached"))
		hook.call({})
		assert results == []

	def test_veto_true(self):
		hook = BailHook()
		hook.tap("blocker", lambda p: True)
		assert hook.call({}) is True

	def test_exception_surfaces(self):
		"""BailHook exceptions should surface."""
		hook = BailHook()
		hook.tap("bad", lambda p: 1 / 0)
		try:
			hook.call({})
			assert False, "should raise"
		except ZeroDivisionError:
			pass


class TestHookBus:
	def test_create_hook_bus(self):
		bus = create_hook_bus()
		assert isinstance(bus.search_completed, SyncHook)
		assert isinstance(bus.greet_before, BailHook)
		assert isinstance(bus.greet_after, SyncHook)
		assert isinstance(bus.auth_state_changed, SyncHook)
		assert isinstance(bus.browser_session_started, SyncHook)
		assert isinstance(bus.browser_session_closed, SyncHook)

	def test_integration_search_completed(self):
		bus = create_hook_bus()
		results = []
		bus.search_completed.tap("log", lambda p: results.append(p["query"]))
		bus.search_completed.call({"query": "golang", "count": 5})
		assert results == ["golang"]

	def test_integration_greet_veto(self):
		bus = create_hook_bus()
		bus.greet_before.tap("block", lambda p: "company blocked")
		result = bus.greet_before.call({"security_id": "s1", "job_id": "j1"})
		assert result == "company blocked"
