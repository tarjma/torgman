import datetime
from typing import List


def format_multiline_caption(text: str, max_chars_per_line: int = 42) -> List[str]:
    """
    Formats text into one or two lines, prioritizing an inverted pyramid shape.
    
    An inverted pyramid means the top line is longer than the bottom line,
    which is generally more aesthetically pleasing for subtitles.
    
    Args:
        text: The text to format
        max_chars_per_line: Maximum characters allowed per line (default: 42, Netflix standard)
    
    Returns:
        A list of one or two strings representing the formatted lines
    """
    if len(text) <= max_chars_per_line:
        return [text]

    words = text.split()
    possible_splits = []
    for i in range(1, len(words)):
        line1 = " ".join(words[:i])
        line2 = " ".join(words[i:])
        if len(line1) <= max_chars_per_line and len(line2) <= max_chars_per_line:
            possible_splits.append((line1, line2))

    if not possible_splits:
        # Fallback if no valid split found, do a hard wrap
        mid_point = text.rfind(' ', 0, max_chars_per_line)
        if mid_point == -1:
            return [text[:max_chars_per_line], text[max_chars_per_line:].strip()]
        return [text[:mid_point], text[mid_point:].strip()]

    # Score splits to prefer inverted pyramids (top-heavy captions)
    best_split = None
    # Score is a tuple: (not is_top_heavy, length_difference). Lower is better.
    # We want is_top_heavy=True to get a score starting with False (0), which is preferred
    best_score = (True, float('inf'))

    for line1, line2 in possible_splits:
        is_top_heavy = len(line1) > len(line2)
        length_difference = abs(len(line1) - len(line2))
        # When is_top_heavy=True, score starts with False (0) - preferred
        # When is_top_heavy=False, score starts with True (1) - less preferred
        score = (not is_top_heavy, length_difference)

        if score < best_score:
            best_score = score
            best_split = (line1, line2)

    return list(best_split)


def format_duration(duration_seconds):
    """Format duration in seconds to HH:MM:SS.sss format"""
    # Create a timedelta object representing the duration
    duration = datetime.timedelta(seconds=duration_seconds)

    # Extract the hours, minutes, seconds, and milliseconds
    hours, remainder = divmod(duration.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = int(duration.microseconds / 1000)

    # Format the duration as 'HH:MM:SS.sss'
    formatted_duration = f'{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}'

    return formatted_duration

def string_to_seconds(time_string):
    """Convert time string HH:MM:SS.sss to seconds"""
    hours, minutes, seconds = time_string.split(':')
    seconds, milliseconds = seconds.split('.')

    total_seconds = int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(milliseconds) / 1000.0
    return float(total_seconds)
