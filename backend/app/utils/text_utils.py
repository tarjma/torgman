import datetime
from typing import List, Dict

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

def caption_segments(
    words, number_of_chars_per_line=37, caption_avg_time=6, chars_per_second=21, time_gap_between_words=0.5, line_clearance_percentage = 0.3
):
    """Break words into caption segments with optimal timing and line breaks"""
    output = []
    while True:
        start_time = words[0]["start"]
        end_time = words[0]["end"]
        lines = [""]
        for idx, word in enumerate(words):
            lines[-1] += word["word"]
            end_time = word["end"]
            if idx + 1 < len(words):
                if (words[idx + 1]["start"] - word["end"]) > time_gap_between_words:
                    break
            if len(lines[-1]) > number_of_chars_per_line:
                if len(lines) == 2:
                    break
                lines.append("")
            if (
                len("\n".join(lines)) > chars_per_second * caption_avg_time
                or (end_time - start_time) > caption_avg_time
            ):
                break

        # Resplit the lines to make sure they are roughly equal in length
        if len(lines) == 2:
            lines[0] = lines[0].strip()
            lines[1] = lines[1].strip()
            line1_words = lines[0].split(" ")
            line2_words = lines[1].split(" ")
            all_words = line1_words + line2_words
            if len(lines[0]) * line_clearance_percentage > len(lines[1]):
                lines[0] = " ".join(all_words[: (len(all_words) // 2 + 1)])
                lines[1] = " ".join(all_words[(len(all_words) // 2 + 1) :])

        output.append({"start": start_time, "end": end_time, "text": "\n".join(lines)})
        words = words[idx + 1 :]
        if len(words) == 0:
            break

    return output

def remove_duplicate_lists(lst: List[List[Dict]]) -> List[List[Dict]]:
    """Remove duplicate dictionaries from nested lists"""
    seen = set()
    result = []
    for inner_list in lst:
        unique_dicts = []
        for dictionary in inner_list:
            dict_set = frozenset(dictionary.items())
            if dict_set not in seen:
                seen.add(dict_set)
                unique_dicts.append(dictionary)
        if unique_dicts:
            result.append(unique_dicts)
    return result
