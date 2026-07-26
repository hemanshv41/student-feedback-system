import unittest
from analyzer import (
    analyze_sentiment,
    detect_topics,
    extract_keywords,
    determine_priority_and_moderation,
    generate_recommendation
)

class TestFeedbackAnalyzer(unittest.TestCase):

    def test_sentiment_analysis(self):
        # Test positive sentiments
        sent, score = analyze_sentiment("The class was amazing and the teacher was extremely helpful.")
        self.assertEqual(sent, "Positive")
        self.assertGreater(score, 0.5)

        # Test negative sentiments
        sent, score = analyze_sentiment("The database assignment instructions were horrible and confusing.")
        self.assertEqual(sent, "Negative")
        self.assertGreater(score, 0.5)

    def test_topic_detection(self):
        # Test teaching category
        topics_teaching = detect_topics("Dr. Jenkins explains sorting algorithms very clearly.")
        self.assertIn("Teaching quality", topics_teaching)

        # Test laboratory category
        topics_labs = detect_topics("The computer labs are very slow and keyboards are broken.")
        self.assertIn("Lab facilities", topics_labs)

        # Test assignments category
        topics_assign = detect_topics("The programming homework project has overlapping deadlines.")
        self.assertIn("Assignments", topics_assign)

        # Test exams category
        topics_exams = detect_topics("The midterm tests and final grading curve are too difficult.")
        self.assertIn("Exams", topics_exams)

        # Test infrastructure category
        topics_infra = detect_topics("Wi-Fi network connection crashes during afternoon classes.")
        self.assertIn("Infrastructure", topics_infra)

    def test_keyword_extraction(self):
        keywords = extract_keywords("Slow computer systems inside the library make research impossible.")
        self.assertIn("computer", keywords)

    def test_priority_flagging(self):
        # Test normal positive
        prio = determine_priority_and_moderation("The classroom projector works fine", "Positive")
        self.assertEqual(prio, "Low")

        # Test normal negative priority
        prio = determine_priority_and_moderation("Assignments are a bit long", "Negative")
        self.assertEqual(prio, "Medium")

        # Test critical negative priority
        prio = determine_priority_and_moderation("The lab computer crashes completely during finals", "Negative")
        self.assertEqual(prio, "High")

        # Test toxic content moderation flagging
        prio = determine_priority_and_moderation("This is the worst garbage class ever. Completely useless teacher is a stupid idiot.", "Negative")
        self.assertEqual(prio, "Flagged Toxic")

    def test_recommendation_logic(self):
        rec_infra = generate_recommendation("Negative", ["Infrastructure"])
        self.assertIn("campus maintenance", rec_infra)
        self.assertIn("projector", rec_infra)

        rec_labs = generate_recommendation("Negative", ["Lab facilities"])
        self.assertIn("hardware", rec_labs)
        self.assertIn("memory", rec_labs)

if __name__ == '__main__':
    unittest.main()
