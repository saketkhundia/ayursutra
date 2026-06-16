import 'package:flutter_test/flutter_test.dart';
import 'package:ayursutra_mobile/main.dart';

void main() {
  testWidgets('App launches', (WidgetTester tester) async {
    await tester.pumpWidget(const AyurSutraApp());
    expect(find.byType(AyurSutraApp), findsOneWidget);
  });
}
