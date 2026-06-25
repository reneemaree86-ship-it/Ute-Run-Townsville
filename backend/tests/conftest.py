import pytest

# pytest-asyncio default mode
def pytest_collection_modifyitems(config, items):
    # leave as-is; markers are applied explicitly
    return items
