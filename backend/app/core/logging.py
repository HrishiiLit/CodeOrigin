import logging
import sys


def setup_logging(level: str = "INFO") -> logging.Logger:
    log_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    logger = logging.getLogger("codeorigin")
    return logger


logger = setup_logging()
