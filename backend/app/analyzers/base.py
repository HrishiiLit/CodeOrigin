from typing import Any, Dict, List, Protocol


class Analyzer(Protocol):
    name: str
    version: str

    def analyze(self, source_path: str) -> List[Dict[str, Any]]:
        """
        Runs static analysis against the target source file and returns
        a list of normalized finding dictionaries.
        """
        ...
