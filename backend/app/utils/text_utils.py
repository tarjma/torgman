import datetime

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
