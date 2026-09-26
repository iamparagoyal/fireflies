import pytest

from app.services.transcript_parser import TranscriptParseError, parse_transcript

VTT = """WEBVTT

00:00:01.000 --> 00:00:04.500
<v Dana Lee>Morning everyone, let's get started.

00:00:05.000 --> 00:00:09.000
<v Sam Ortiz>Sounds good. I'll share the roadmap first.
"""

SRT = """1
00:00:01,000 --> 00:00:03,000
Dana Lee: Hello there.

2
00:00:03,500 --> 00:00:06,000
Sam Ortiz: Hi Dana.
"""


def test_vtt_voice_tags():
    segments = parse_transcript(VTT)
    assert [s.speaker for s in segments] == ["Dana Lee", "Sam Ortiz"]
    assert segments[1].start == 5.0
    assert segments[1].text == "Sounds good. I'll share the roadmap first."


def test_srt_with_speaker_prefix():
    segments = parse_transcript(SRT)
    assert segments[0].speaker == "Dana Lee"
    assert segments[1].end == 6.0


def test_txt_with_bracketed_timestamps():
    segments = parse_transcript("[00:00:05] Dana: One\n[00:01:10] Sam: Two words here")
    assert segments[0].start == 5 and segments[1].start == 70
    assert segments[0].end <= 70


def test_txt_without_timestamps_estimates_timing():
    segments = parse_transcript("Dana: first line with some words\nSam: second line")
    assert segments[0].start == 0
    assert segments[1].start == pytest.approx(segments[0].end)


def test_json_segments():
    segments = parse_transcript('[{"speaker": "A", "start": 0, "end": 2, "text": "Hi"}, {"speaker": "B", "start": 2, "end": 5, "text": "Hey"}]')
    assert [s.speaker for s in segments] == ["A", "B"]


def test_consecutive_same_speaker_lines_merge():
    segments = parse_transcript("Dana: one\nDana: two\nSam: three")
    assert len(segments) == 2
    assert segments[0].text == "one two"


def test_empty_transcript_rejected():
    with pytest.raises(TranscriptParseError):
        parse_transcript("   ")
