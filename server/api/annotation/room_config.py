"""
Room configuration module for BakalAPI timetable annotation.
Contains valid room codes from the school's timetable system.
"""

# Valid room codes from BakalAPI (38 rooms total)
# These are the identifiers used in the school's timetable system
VALID_ROOM_CODES = [
    # A building
    "a1", "a2", "a3", "a4", "a5", "aula", "av",
    # B building
    "b1", "b2", "b3", "b4", "b5", "b6", "b7", "BC", "bi",
    # C building
    "c1", "c2", "c3", "c4", "c5", "c6", "c7", "ch",
    # Special rooms
    "el", "f",
    # J building
    "j1", "j2", "j3",
    # Labs
    "lbi", "lch", "lf",
    # Other
    "sbor", "tv1", "tv2", "tv3", "tv4", "Vv"
]

# Room code display names (optional, for UI enhancement)
ROOM_CODE_LABELS = {
    "aula": "Aula",
    "av": "Audiovizuální",
    "BC": "Biologická centra",
    "bi": "Biologie",
    "ch": "Chemie",
    "el": "Elektrotechnika",
    "f": "Fyzika",
    "lbi": "Laboratoř biologie",
    "lch": "Laboratoř chemie",
    "lf": "Laboratoř fyziky",
    "sbor": "Sborovna",
    "tv1": "Tělocvična 1",
    "tv2": "Tělocvična 2",
    "tv3": "Tělocvična 3",
    "tv4": "Tělocvična 4",
    "Vv": "Výtvarná výchova"
}


def is_valid_room_code(code: str) -> bool:
    """Check if a room code is valid."""
    return code in VALID_ROOM_CODES


def get_room_label(code: str) -> str:
    """Get human-readable label for a room code."""
    return ROOM_CODE_LABELS.get(code, code.upper())


def get_room_options():
    """Get room codes as options for API/frontend (list of dicts)."""
    return [
        {"value": code, "label": get_room_label(code)}
        for code in VALID_ROOM_CODES
    ]
