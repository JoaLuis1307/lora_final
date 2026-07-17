import 'package:flutter/material.dart';

class SkeletonLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SkeletonLoader({
    Key? key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 8,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: cs.outlineVariant.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class SkeletonCard extends StatelessWidget {
  final double height;

  const SkeletonCard({Key? key, this.height = 120}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonLoader(width: 36, height: 36, borderRadius: 8),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(width: 160, height: 14, borderRadius: 4),
                    const SizedBox(height: 6),
                    SkeletonLoader(width: 100, height: 10, borderRadius: 4),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SkeletonLoader(height: 8, borderRadius: 4),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonLoader(width: 80, height: 10, borderRadius: 4),
              SkeletonLoader(width: 120, height: 10, borderRadius: 4),
            ],
          ),
        ],
      ),
    );
  }
}

class OverviewSkeleton extends StatelessWidget {
  const OverviewSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonLoader(width: 200, height: 12, borderRadius: 4),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: SkeletonLoader(height: 96, borderRadius: 16)),
              const SizedBox(width: 12),
              Expanded(child: SkeletonLoader(height: 96, borderRadius: 16)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: SkeletonLoader(height: 96, borderRadius: 16)),
              const SizedBox(width: 12),
              Expanded(child: SkeletonLoader(height: 96, borderRadius: 16)),
            ],
          ),
          const SizedBox(height: 24),
          SkeletonLoader(width: 180, height: 12, borderRadius: 4),
          const SizedBox(height: 12),
          const SkeletonCard(height: 80),
          const SizedBox(height: 10),
          const SkeletonCard(height: 80),
        ],
      ),
    );
  }
}
